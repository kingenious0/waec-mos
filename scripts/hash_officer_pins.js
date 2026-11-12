/**
 * One-time migration: hash every plaintext field-officer PIN in the database.
 * Legacy rows store e.g. "1234"; scrypt hashes look like "<salt>:<hex>".
 * Rows that are already hashed are skipped, so this is safe to re-run.
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

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `${salt}:${key}`;
}

async function run() {
  console.log('--- HASHING PLAINTEXT FIELD-OFFICER PINS ---');
  const rows = await sql`
    SELECT "id", "pin" FROM "user"
    WHERE "role" = 'FIELD_OFFICER' AND "pin" IS NOT NULL AND "pin" <> ''
  `;
  let hashed = 0;
  let skipped = 0;
  for (const row of rows) {
    const pin = String(row.pin).trim();
    const isHash = pin.split(':').length === 2 && /^[0-9a-f]{32}:[0-9a-f]{128}$/.test(pin);
    if (isHash) {
      skipped += 1;
      continue;
    }
    await sql`UPDATE "user" SET "pin" = ${hashPin(pin)} WHERE "id" = ${row.id}`;
    hashed += 1;
  }
  console.log(`Done. hashed=${hashed}, already-hashed=${skipped}, total=${rows.length}`);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
