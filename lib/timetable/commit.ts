/**
 * Atomic timetable replace — the only path that writes exam_timetable rows.
 *
 * A series' timetable is swapped in ONE sql statement
 * (delete current rows → insert new rows → write the import audit row).
 * If any part fails, the whole statement rolls back and the old timetable stays intact.
 * Used by both the admin import/commit API route and scripts/seed_timetable.ts.
 */
import { neon } from '@neondatabase/serverless'
import { env } from '@/lib/env'
import type { TimetableRowInput } from './types'

const sql = neon(env.DATABASE_URL)

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const SLOTS = new Set(['MORNING', 'AFTERNOON', 'FULL_DAY'])

export class TimetableValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join(' | '))
    this.name = 'TimetableValidationError'
  }
}

/** Normalise + hard-validate rows. Throws TimetableValidationError listing every problem. */
export function validateRows(rows: TimetableRowInput[]): TimetableRowInput[] {
  const problems: string[] = []
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new TimetableValidationError(['The timetable file produced no papers to import.'])
  }
  if (rows.length > 1000) {
    throw new TimetableValidationError(['More than 1000 papers in one import — check the file.'])
  }
  const clean = rows.map((row, i) => {
    const n = i + 1
    const examDate = String(row.examDate || '').trim()
    const m = examDate.match(ISO_DATE)
    if (!m) {
      problems.push(`Row ${n}: missing or invalid examination date (expected YYYY-MM-DD).`)
    } else {
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
      if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
        problems.push(`Row ${n}: ${examDate} is not a real calendar date.`)
      }
    }
    const paperName = String(row.paperName || '').replace(/\s+/g, ' ').trim()
    if (paperName.length < 3) problems.push(`Row ${n}: paper name is missing or too short.`)
    if (paperName.length > 240) problems.push(`Row ${n}: paper name is longer than 240 characters.`)
    const paperCode = row.paperCode ? String(row.paperCode).trim().slice(0, 40) : null
    const needsCouncilTime = Boolean(row.needsCouncilTime)
    const startTime = row.startTime ? String(row.startTime).trim() : null
    const endTime = row.endTime ? String(row.endTime).trim() : null
    if (!needsCouncilTime) {
      if (!startTime || !TIME.test(startTime)) problems.push(`Row ${n}: start time missing/invalid (expected HH:MM, 24h).`)
      if (!endTime || !TIME.test(endTime)) problems.push(`Row ${n}: end time missing/invalid (expected HH:MM, 24h).`)
      if (startTime && endTime && TIME.test(startTime) && TIME.test(endTime) && startTime >= endTime) {
        problems.push(`Row ${n}: start time (${startTime}) is not before end time (${endTime}).`)
      }
    }
    const sessionSlot = SLOTS.has(String(row.sessionSlot)) ? String(row.sessionSlot) : 'MORNING'
    return {
      examDate,
      sessionSlot: sessionSlot as TimetableRowInput['sessionSlot'],
      paperCode,
      paperName,
      durationText: row.durationText ? String(row.durationText).trim().slice(0, 80) : null,
      startTime: startTime || null,
      endTime: endTime || null,
      needsCouncilTime,
      isNewCurriculum: Boolean(row.isNewCurriculum),
      sortOrder: i,
      warnings: [],
    }
  })
  if (problems.length > 0) throw new TimetableValidationError(problems)
  return clean
}

export interface CommitInput {
  operationId: string
  fileName: string
  sourceFormat: 'PDF' | 'DOCX' | 'CSV' | 'XLSX'
  actorId: string
  actorName?: string | null
  rows: TimetableRowInput[]
}

export interface CommitResult {
  removed: number
  imported: number
  importId: string
}

/** Replace a series' timetable atomically. Throws on validation/DB errors — nothing is written then. */
export async function replaceTimetable(input: CommitInput): Promise<CommitResult> {
  const rows = validateRows(input.rows)
  const stamp = Date.now()
  const importId = `ti-${stamp}`
  const payload = rows.map((r, i) => ({
    id: `tt-${stamp}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    operation_id: input.operationId,
    exam_date: r.examDate,
    session_slot: r.sessionSlot,
    paper_code: r.paperCode,
    paper_name: r.paperName,
    duration_text: r.durationText,
    start_time: r.startTime,
    end_time: r.endTime,
    needs_council_time: r.needsCouncilTime,
    is_new_curriculum: r.isNewCurriculum,
    sort_order: r.sortOrder,
  }))

  const result = await sql`
    WITH doomed AS (
      DELETE FROM exam_timetable WHERE operation_id = ${input.operationId} RETURNING id
    ),
    payload AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(
        id text, operation_id text, exam_date text, session_slot text, paper_code text,
        paper_name text, duration_text text, start_time text, end_time text,
        needs_council_time boolean, is_new_curriculum boolean, sort_order integer
      )
    ),
    ins AS (
      INSERT INTO exam_timetable (
        id, operation_id, exam_date, session_slot, paper_code, paper_name,
        duration_text, start_time, end_time, needs_council_time, is_new_curriculum,
        sort_order, created_at, updated_at
      )
      SELECT id, operation_id, exam_date, session_slot, paper_code, paper_name,
             duration_text, start_time, end_time, needs_council_time, is_new_curriculum,
             sort_order, now(), now()
      FROM payload
      RETURNING id
    ),
    log AS (
      INSERT INTO timetable_imports (
        id, operation_id, file_name, source_format,
        removed_count, imported_count, imported_by, imported_by_name, created_at
      )
      SELECT ${importId}, ${input.operationId}, ${String(input.fileName).slice(0, 240)}, ${input.sourceFormat},
             (SELECT count(*) FROM doomed), (SELECT count(*) FROM ins),
             ${input.actorId}, ${input.actorName ? String(input.actorName).slice(0, 160) : null}, now()
      RETURNING id
    )
    SELECT (SELECT count(*)::int FROM doomed) AS removed,
           (SELECT count(*)::int FROM ins) AS imported
  `
  const row = result[0] as { removed: number; imported: number } | undefined
  return {
    removed: row?.removed ?? 0,
    imported: row?.imported ?? rows.length,
    importId,
  }
}
