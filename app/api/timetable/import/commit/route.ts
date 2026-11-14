import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guard'
import { recordAuditLog, recordSecurityEvent } from '@/lib/db/audit'
import { replaceTimetable, TimetableValidationError } from '@/lib/timetable/commit'
import { z } from 'zod'

const commitSchema = z.object({
  operationId: z.string().min(1),
  fileName: z.string().min(1).max(240),
  sourceFormat: z.enum(['PDF', 'DOCX', 'CSV', 'XLSX']),
  actorName: z.string().max(160).optional(),
})

/**
 * POST /api/timetable/import/commit
 * Atomically replaces a series' timetable with the reviewed rows.
 * Admins only. The delete + insert + audit-log row happen in ONE SQL statement —
 * if anything fails, the old timetable stays exactly as it was.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error

    const body = await request.json()
    const parsed = commitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid import request', status: 400 }, { status: 400 })
    }
    const { operationId, fileName, sourceFormat } = parsed.data
    const rows = body.rows
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'Missing rows to import.', status: 400 }, { status: 400 })
    }

    const out = await replaceTimetable({
      operationId,
      fileName,
      sourceFormat,
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      rows,
    })

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'TIMETABLE_IMPORTED',
      entityType: 'exam_timetable',
      entityId: operationId,
      details: { fileName, sourceFormat, removed: out.removed, imported: out.imported, importId: out.importId },
    })
    await recordSecurityEvent({
      action: 'TIMETABLE_IMPORTED',
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      details: { operationId, fileName, sourceFormat, removed: out.removed, imported: out.imported },
    })

    return NextResponse.json({ ok: true, removed: out.removed, imported: out.imported, importId: out.importId })
  } catch (err) {
    if (err instanceof TimetableValidationError) {
      return NextResponse.json({ error: err.message, status: 400, problems: err.problems }, { status: 400 })
    }
    console.error('timetable import commit failed:', err)
    return NextResponse.json({ error: 'The timetable could not be saved. The previous timetable is unchanged.', status: 500 }, { status: 500 })
  }
}
