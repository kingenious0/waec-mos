/**
 * Phase 1 auth hardening migration:
 *  1. user: failed_login_attempts / locked_until / lockout_count columns
 *  2. rate_limits table (IP / phone sign-in throttling)
 *  3. PURGE every officer PIN — plain-text-era PINs cannot survive the
 *     argon2id migration, so all accounts must reset their PIN.
 * Idempotent. Run once.
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
  console.log('--- PHASE 1: AUTH HARDENING MIGRATION ---');

  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "locked_until" timestamptz`;
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lockout_count" integer NOT NULL DEFAULT 0`;

  await sql`
    CREATE TABLE IF NOT EXISTS "rate_limits" (
      "key" text PRIMARY KEY,
      "count" integer NOT NULL DEFAULT 0,
      "reset_at" timestamptz NOT NULL
    )
  `;

  const purged = await sql`
    UPDATE "user"
    SET pin = NULL, pin_changed_at = NULL
    WHERE pin IS NOT NULL AND role = 'FIELD_OFFICER'
    RETURNING id
  `;
  console.log(`PINs purged: ${purged.length} field officer(s)`);

  await sql`
    INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details)
    VALUES (
      'audit-pin-purge',
      'system',
      'System',
      'SYSTEM',
      'SECURITY_PIN_PURGE',
      'users',
      'all',
      ${JSON.stringify({ message: 'All officer PINs were invalidated during the argon2id credential migration. Each account must set a new PIN.' })}::jsonb
    )
    ON CONFLICT (id) DO NOTHING
  `;

  console.log('Migration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
