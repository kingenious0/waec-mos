import { NextResponse } from 'next/server'
import { requireCommand } from '@/lib/auth/guard'
import { parseTimetableFile } from '@/lib/timetable/import'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024 // official WAEC timetables are 200KB–2MB

/**
 * POST /api/timetable/import/preview
 * Multipart form: file (the official PDF by default; DOCX/CSV/XLSX accepted).
 * Returns parsed candidate rows for HQ to review — never touches the database.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose the timetable file to import (PDF preferred).', status: 400 }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large — official timetable PDFs are well under 12 MB.', status: 413 }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await parseTimetableFile(file.name, buffer)
    return NextResponse.json(result)
  } catch (err) {
    console.error('timetable preview failed:', err)
    const message = err instanceof Error ? err.message : 'Could not read that file.'
    return NextResponse.json({ error: message, status: 422 }, { status: 422 })
  }
}
