/**
 * Fix arrival_events column mismatch with the drizzle schema:
 *   schema maps lat/lng -> columns "latitude"/"longitude",
 *   the original migration created "lat"/"lng" instead.
 * This 500'd /api/field/duty and /api/field/arrival on production.
 * The table is empty — safe rename. Idempotent.
 */
const path = require('path');
const fs = require('fs');
const { neon } = require(path.resolve('node_modules/@neondatabase/serverless'));
const env = fs.readFileSync('.env', 'utf-8');
const m = env.match(/DATABASE_URL=([^\r\n]+)/);
if (!m) { console.error('No DATABASE_URL in .env'); process.exit(1); }
const sql = neon(m[1].trim());

(async () => {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'arrival_events' ORDER BY ordinal_position`;
  const names = cols.map((c) => c.column_name);
  console.log('columns before:', names.join(', '));

  if (names.includes('lat') && !names.includes('latitude')) {
    await sql`ALTER TABLE arrival_events RENAME COLUMN lat TO latitude`;
    console.log('lat -> latitude ✓');
  } else {
    console.log('latitude already correct (skipped)');
  }

  if (names.includes('lng') && !names.includes('longitude')) {
    await sql`ALTER TABLE arrival_events RENAME COLUMN lng TO longitude`;
    console.log('lng -> longitude ✓');
  } else {
    console.log('longitude already correct (skipped)');
  }

  const after = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'arrival_events' ORDER BY ordinal_position`;
  console.log('columns after:', after.map((c) => c.column_name).join(', '));
})().catch((e) => { console.error('ERR', e); process.exit(1); });
