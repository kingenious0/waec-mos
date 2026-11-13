/**
 * Phase 3 schema migration:
 *  1. system_settings.admin_sms_check (Extra check for admins, on by default)
 *  2. sms_codes table (hashed, expiring, single-use login codes)
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
  console.log('--- PHASE 3: SMS 2FA MIGRATION ---');

  await sql`
    ALTER TABLE "system_settings"
    ADD COLUMN IF NOT EXISTS "admin_sms_check" boolean NOT NULL DEFAULT true
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "sms_codes" (
      id text PRIMARY KEY,
      "userId" text NOT NULL,
      purpose text NOT NULL DEFAULT 'admin_login',
      code_hash text NOT NULL,
      phone text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      "expiresAt" timestamptz NOT NULL,
      "usedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `;

  console.log('Migration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
