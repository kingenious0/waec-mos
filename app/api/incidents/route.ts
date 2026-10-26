import { Pool } from 'pg'
import { NextResponse } from 'next/server'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const incidentSchema = {
  officerName: (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 120,
  groupNumber: (value: unknown) => typeof value === 'string' && value.trim().length <= 20,
  centerName: (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 160,
  type: (value: unknown) => value === 'sos' || value === 'dispatch' || value === 'check-in',
}

export async function GET() {
  const result = await pool.query(
    'SELECT id, officer_name, group_number, center_name, type, status, message, created_at FROM public.mos_incidents ORDER BY created_at DESC LIMIT 50',
  )
  return NextResponse.json({ incidents: result.rows })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || !incidentSchema.officerName(body.officerName) || !incidentSchema.groupNumber(body.groupNumber) || !incidentSchema.centerName(body.centerName) || !incidentSchema.type(body.type)) {
    return NextResponse.json({ error: 'Invalid incident payload' }, { status: 400 })
  }

  const result = await pool.query(
    `INSERT INTO public.mos_incidents (officer_name, group_number, center_name, type, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, officer_name, group_number, center_name, type, status, message, created_at`,
    [body.officerName.trim(), body.groupNumber.trim(), body.centerName.trim(), body.type, typeof body.message === 'string' ? body.message.slice(0, 500) : null],
  )
  return NextResponse.json({ incident: result.rows[0] }, { status: 201 })
}
