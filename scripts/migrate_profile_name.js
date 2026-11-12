/**
 * One-off schema migration:
 *  1. Adds title / first_name / last_name / pin_changed_at to the user table
 *     (idempotent — safe to re-run).
 *  2. Splits the existing display `name` into title / first_name / last_name.
 *     Honors leading honorifics (Dr. etc.). Leaves already-split rows alone.
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

const KNOWN_TITLES = ['Dr.', 'Prof.', 'Mr.', 'Mrs.', 'Ms.', 'Eng.'];

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { title: '', firstName: '', lastName: '' };
  let title = '';
  if (KNOWN_TITLES.includes(parts[0])) {
    title = parts.shift();
  }
  if (parts.length === 0) return { title, firstName: '', lastName: '' };
  if (parts.length === 1) return { title, firstName: parts[0], lastName: '' };
  return { title, firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function run() {
  console.log('--- SPLITTING USER NAMES INTO title / first_name / last_name ---');

  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "title" text DEFAULT ''`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "first_name" text DEFAULT ''`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_name" text DEFAULT ''`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pin_changed_at" timestamptz`;

  const rows = await sql`SELECT id, name, first_name FROM "user"`;
  let split = 0;
  let kept = 0;
  for (const row of rows) {
    if (row.first_name && String(row.first_name).trim()) {
      kept += 1;
      continue;
    }
    const { title, firstName, lastName } = splitName(row.name);
    await sql`
      UPDATE "user"
      SET title = ${title}, first_name = ${firstName}, last_name = ${lastName}
      WHERE id = ${row.id}
    `;
    split += 1;
  }
  console.log(`Done. split=${split}, already-split=${kept}, total=${rows.length}`);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
