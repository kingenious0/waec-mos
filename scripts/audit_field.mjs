// One-off read-only audit of the field-assignment data in prod.
// Usage: node scripts/audit_field.mjs
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'

const envText = readFileSync('.env', 'utf8')
const line = envText.split(/\r?\n/).find((l) => l.includes('DATABASE_URL='))
const url = line?.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
if (!url) { console.error('No DATABASE_URL in .env'); process.exit(1) }

const sql = neon(url)

const [{ counts }] = await sql`select json_build_object(
  'assignments', (select count(*) from assignments),
  'exam_timetable', (select count(*) from exam_timetable),
  'officer_deployments', (select count(*) from officer_deployments),
  'users_officers', (select count(*) from "user" where role = 'FIELD_OFFICER')
)::text as counts`
console.log('COUNTS:', counts)

const rows = await sql`select date(a.date) as date, a.paper_name, a.start_time, a.end_time, a.status from assignments a order by a.date desc limit 8`
console.table(rows)

const users = await sql`select id, name, staff_id, status, is_sos_active from "user" where role = 'FIELD_OFFICER' order by updated_at desc limit 4`
console.table(users)
