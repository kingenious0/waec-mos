/**
 * Timetable feature migration (idempotent — safe to re-run):
 *   1. Creates exam_timetable / officer_deployments / timetable_imports.
 *   2. Adds the unique anchor index and the operation+date index.
 *   3. Seeds the missing operations (series) rows whose official 2026 windows
 *      are known from the published timetables:
 *        - BECE 2026 SC & PC            04 May 2026 → 11 May 2026
 *        - WASSCE PC 2 2026 (Ghana)     04 Sep 2026 → 29 Oct 2026
 *      (2026 WASSCE SC row already exists as op-wassce-2026; its stored
 *      window is corrected to the official 07 Apr → 15 Jun 2026.)
 *   4. 2026 WASSCE PC First Series is intentionally NOT created — WAEC Ghana
 *      has not published the paper-by-paper timetable, so no dates are known.
 *      HQ creates it from the UI once the official file is released.
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
  console.log('--- TIMETABLE TABLES ---');

  await sql`
    CREATE TABLE IF NOT EXISTS exam_timetable (
      id text PRIMARY KEY,
      operation_id text NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      exam_date text NOT NULL,
      session_slot text NOT NULL DEFAULT 'MORNING',
      paper_code text,
      paper_name text NOT NULL,
      duration_text text,
      start_time text,
      end_time text,
      needs_council_time boolean NOT NULL DEFAULT false,
      is_new_curriculum boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log('exam_timetable ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS officer_deployments (
      id text PRIMARY KEY,
      operation_id text NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      officer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      center_id text NOT NULL REFERENCES examination_centers(id),
      deployment_date text NOT NULL DEFAULT '',
      shift_role text NOT NULL DEFAULT 'MONITOR',
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log('officer_deployments ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS timetable_imports (
      id text PRIMARY KEY,
      operation_id text NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      file_name text NOT NULL,
      source_format text NOT NULL,
      removed_count integer NOT NULL DEFAULT 0,
      imported_count integer NOT NULL DEFAULT 0,
      imported_by text NOT NULL,
      imported_by_name text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log('timetable_imports ✓');

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS officer_deployments_anchor_key
    ON officer_deployments (operation_id, officer_id, deployment_date)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS exam_timetable_operation_date
    ON exam_timetable (operation_id, exam_date)
  `;
  console.log('indexes ✓');

  console.log('--- OPERATIONS (SERIES) ROWS ---');

  const bece = await sql`
    INSERT INTO operations (id, name, series_year, start_date, end_date, status)
    VALUES ('op-bece-2026', '2026 BECE SC & PC', 2026,
            TIMESTAMPTZ '2026-05-04 00:00:00+00', TIMESTAMPTZ '2026-05-11 23:59:59+00', 'COMPLETED')
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  console.log('op-bece-2026:', bece.length ? 'created' : 'already existed');

  const pc2 = await sql`
    INSERT INTO operations (id, name, series_year, start_date, end_date, status)
    VALUES ('op-wassce-pc2-2026', '2026 WASSCE PC (Second Series)', 2026,
            TIMESTAMPTZ '2026-09-04 00:00:00+00', TIMESTAMPTZ '2026-10-29 23:59:59+00', 'COMPLETED')
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  console.log('op-wassce-pc2-2026:', pc2.length ? 'created' : 'already existed');

  // Correct the SC row to the official 2026 window (was 01 May → 30 Jun).
  const before = await sql`SELECT start_date, end_date FROM operations WHERE id = 'op-wassce-2026'`;
  if (before.length && before[0].start_date.toISOString().slice(0, 10) !== '2026-04-07') {
    await sql`
      UPDATE operations
      SET start_date = TIMESTAMPTZ '2026-04-07 00:00:00+00',
          end_date   = TIMESTAMPTZ '2026-06-15 23:59:59+00'
      WHERE id = 'op-wassce-2026'
    `;
    console.log('op-wassce-2026: dates corrected 2026-05-01→2026-04-07, 2026-06-30→2026-06-15');
  } else {
    console.log('op-wassce-2026: dates already official, left unchanged');
  }

  const ops = await sql`SELECT id, name, status, start_date, end_date FROM operations ORDER BY start_date`;
  console.log('current operations:', JSON.stringify(ops, null, 2));
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
