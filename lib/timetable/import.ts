/**
 * Server-side dispatcher: takes an uploaded timetable file (PDF default, plus DOCX/CSV/XLSX)
 * and returns parsed preview rows. Never touches the database — the preview route returns
 * this to the browser, HQ reviews/fixes it, then the commit route writes it atomically.
 */
import { extractText, getDocumentProxy } from 'unpdf'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { TimetableRowInput, TimetableImportResult } from './types'
import { parseCsvText, parseRawText, parseTable } from './parse'

export type SourceFormat = TimetableImportResult['sourceFormat']

export function formatForFileName(fileName: string): SourceFormat | null {
  const ext = String(fileName || '').toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'PDF'
  if (ext === 'docx') return 'DOCX'
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') return 'CSV'
  if (ext === 'xlsx' || ext === 'xls') return 'XLSX'
  return null
}

function buildStats(rows: TimetableRowInput[]): TimetableImportResult['stats'] {
  return {
    total: rows.length,
    dated: rows.filter((r) => r.examDate).length,
    undated: rows.filter((r) => !r.examDate).length,
    needsTime: rows.filter((r) => r.needsCouncilTime).length,
    withWarnings: rows.filter((r) => r.warnings.length > 0).length,
  }
}

async function pdfToRows(buffer: Buffer): Promise<TimetableRowInput[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return parseRawText(text)
}

async function docxToRows(buffer: Buffer): Promise<TimetableRowInput[]> {
  const { value } = await mammoth.extractRawText({ buffer })
  const text = String(value || '')
  // A DOCX that contains an actual table extracts with tab/newline grids; try the
  // WAEC-text parser first, then the table parser if the grid looks tabular.
  const rawRows = parseRawText(text)
  if (rawRows.length > 0) return rawRows
  const grid = text
    .split('\n')
    .map((l) => l.split('\t').map((c) => c.trim()))
    .filter((cells) => cells.some((c) => c))
  return parseTable(grid)
}

async function xlsxToRows(buffer: Buffer): Promise<TimetableRowInput[]> {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('The spreadsheet has no sheets.')
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
  return parseTable(grid.map((row) => row.map((c) => String(c ?? ''))))
}

/** Parse an uploaded timetable file into preview rows. Throws on unreadable/unsupported files. */
export async function parseTimetableFile(fileName: string, buffer: Buffer): Promise<TimetableImportResult> {
  const sourceFormat = formatForFileName(fileName)
  if (!sourceFormat) {
    throw new Error('Unsupported file type. Upload the WAEC timetable as PDF (default), or DOCX, CSV or Excel.')
  }
  let rows: TimetableRowInput[]
  if (sourceFormat === 'PDF') rows = await pdfToRows(buffer)
  else if (sourceFormat === 'DOCX') rows = await docxToRows(buffer)
  else if (sourceFormat === 'CSV') rows = parseCsvText(buffer.toString('utf-8'))
  else rows = await xlsxToRows(buffer)

  // Normalise: stable ordering, dedup exact duplicate rows from multi-page tables.
  const seen = new Set<string>()
  rows = rows.filter((row) => {
    const key = `${row.examDate}|${row.sessionSlot}|${row.paperCode}|${row.paperName}|${row.startTime}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  rows = rows.map((row, i) => ({ ...row, sortOrder: i }))

  return { fileName, sourceFormat, rows, stats: buildStats(rows) }
}
