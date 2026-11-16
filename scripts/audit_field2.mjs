// One-off read-only inspection of deployments + assignments.
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'

const envText = readFileSync('.env', 'utf8')
const line = envText.split(/\r?\n/).find((l) => l.includes('DATABASE_URL='))
const url = line?.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
const sql = neon(url)

const deploymentJoin = await sql`select d.officer_id, d.deployment_date, d.shift_role, d.center_id, o.name as series_name, o.status as series_status
  from officer_deployments d join operations o on o.id = d.operation_id`
console.table(deploymentJoin)

const assignments = await sql`select id, officer_id, paper_name, start_time, end_time, date, status, center_id from assignments`
console.table(assignments)

const officer = await sql`select id, name, staff_id, phone, role, status from "user" where role = 'FIELD_OFFICER'`
console.table(officer)
