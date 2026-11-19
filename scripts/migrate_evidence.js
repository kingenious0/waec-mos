/**
 * Evidence photos migration (idempotent — safe to re-run):
 *   - evidence_photos: watermarked arrival proof, one per check-in.
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
  console.log('--- EVIDENCE PHOTOS TABLE ---');

  await sql`
    CREATE TABLE IF NOT EXISTS evidence_photos (
      id text PRIMARY KEY,
      officer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      assignment_id text REFERENCES assignments(id) ON DELETE SET NULL,
      center_id text REFERENCES examination_centers(id) ON DELETE SET NULL,
      mime_type text NOT NULL,
      photo bytea NOT NULL,
      watermark text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log('evidence_photos ✓');

  await sql`
    CREATE INDEX IF NOT EXISTS evidence_photos_officer_date
    ON evidence_photos (officer_id, created_at DESC)
  `;
  console.log('index ✓');

  console.log('Migration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
