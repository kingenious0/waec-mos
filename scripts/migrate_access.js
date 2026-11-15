/**
 * Account requests migration (idempotent):
 *   Creates account_requests (new-officer access) and pin_reset_requests (PIN resets).
 *   Indexes on status + created_at for the controller review lists.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { neon } = require(path.resolve('node_modules/@neondatabase/serverless'));

const env = fs.readFileSync('.env', 'utf-8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
if (!match) {
  console.error('No DATABASE_URL found in .env');
  process.exit(1);
}
const sql = neon(match[1].trim());

async function run() {
  await sql`
    CREATE TABLE IF NOT EXISTS account_requests (
      id text PRIMARY KEY,
      full_name text NOT NULL,
      phone text NOT NULL,
      staff_id text NOT NULL,
      pin_hash text NOT NULL,
      status text NOT NULL DEFAULT 'PENDING',
      note text,
      created_by_ip text,
      created_at timestamptz NOT NULL DEFAULT now(),
      decided_at timestamptz,
      decided_by text,
      decided_by_name text
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS account_requests_status_created ON account_requests (status, created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS pin_reset_requests (
      id text PRIMARY KEY,
      officer_id text,
      officer_name text,
      officer_phone text NOT NULL,
      staff_id text,
      status text NOT NULL DEFAULT 'PENDING',
      note text,
      created_by_ip text,
      created_at timestamptz NOT NULL DEFAULT now(),
      decided_at timestamptz,
      decided_by text,
      decided_by_name text,
      temp_expires_at timestamptz
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS pin_reset_requests_status_created ON pin_reset_requests (status, created_at DESC)`;

  // Uniqueness of pending requests is NOT enforced at the DB level — we rely on
  // application-level duplicate prevention so a declined requester isn't locked out
  // of re-applying from another device.

  console.log('account_requests + pin_reset_requests ready');
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name IN ('account_requests', 'pin_reset_requests')`;
  console.log(JSON.stringify(tables));
}
run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
