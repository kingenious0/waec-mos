/** Phase 5 schema migration: lockdown + location mode + security ledger. */
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
  console.log('--- PHASE 5: SAFETY CENTER MIGRATION ---');

  await sql`
    ALTER TABLE "system_settings"
    ADD COLUMN IF NOT EXISTS "location_only_on_duty" boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "lockdown_active" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "lockdown_enabled_by" text,
    ADD COLUMN IF NOT EXISTS "lockdown_enabled_at" timestamptz
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "security_events" (
      id text PRIMARY KEY,
      action text NOT NULL,
      "actorId" text,
      "actorName" text,
      "actorRole" text,
      "targetUserId" text,
      "targetUserName" text,
      details jsonb,
      "ipAddress" text,
      "userAgent" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "security_events_created_at_idx" ON security_events ("createdAt" DESC)`;

  console.log('Migration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
