import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { headers } from 'next/headers'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const result = await pool.query('SELECT "role" FROM "user" WHERE "id" = $1 LIMIT 1', [session.user.id])
  return result.rows[0]?.role === 'admin' ? session : null
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!name || !email || password.length < 8) return Response.json({ error: 'Name, email, and an 8-character password are required.' }, { status: 400 })
  const created = await auth.api.signUpEmail({ body: { name, email, password } })
  if (!created?.user?.id) return Response.json({ error: 'Unable to create account.' }, { status: 400 })
  await pool.query('UPDATE "user" SET "role" = $1 WHERE "id" = $2', ['field_officer', created.user.id])
  return Response.json({ id: created.user.id, name, email })
}

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await pool.query('SELECT "id", "name", "email", "role", "createdAt" FROM "user" ORDER BY "createdAt" DESC')
  return Response.json(result.rows)
}
