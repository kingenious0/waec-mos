/**
 * On-request proof photos migration (idempotent — safe to re-run).
 * Creates the small ledger behind "Ask for photo proof" in the console and
 * the officer app. No existing table is altered.
 */
const path = require('path');
const fs = require('fs');
const { neon } = require(path.resolve('node_modules/@neondatabase/serverless'));

const env = fs.readFileSync('.env', 'utf-8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
if (!match) {
  console.error('No DATABASE_URL found in .env');
  process.exit(1);
}
const sql = neon(match[1].trim());

async function run() {
  console.log('--- PHOTO REQUESTS TABLE ---');

  await sql`
    CREATE TABLE IF NOT EXISTS photo_requests (
      id text PRIMARY KEY,
      officer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      requester_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      requester_name text NOT NULL,
      reason text NOT NULL,
      status text NOT NULL DEFAULT 'PENDING',
      evidence_id text REFERENCES evidence_photos(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      fulfilled_at timestamptz
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS photo_requests_officer_status_idx
      ON photo_requests (officer_id, status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS photo_requests_requester_status_idx
      ON photo_requests (requester_id, status)
  `;

  console.log('photo_requests ready ✓');
}

run().catch((error) => {
  console.error('ERR', error);
  process.exit(1);
});
