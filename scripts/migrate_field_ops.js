/**
 * Field operations V1:1 migration (idempotent — safe to re-run):
 *   1. Creates field_groups / daily_school_assignments / arrival_events / monitored_papers.
 *   2. Seeds the remaining Ghana regions (16 total) and their regional capitals
 *      as starter districts. Ashanti/Central/Accra districts already exist.
 *   3. Adds a group_id column to "user" for group membership (nullable).
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

// Ghana's 16 regions (name, code) — official GA/Regions mapping
const REGIONS = [
  ['reg-ahafo', 'Ahafo Region', 'AF'],
  ['reg-ashanti', 'Ashanti Region', 'AR'],
  ['reg-bono', 'Bono Region', 'BR'],
  ['reg-bono-east', 'Bono East Region', 'BER'],
  ['reg-central-region', 'Central Region', 'CR'],
  ['reg-eastern', 'Eastern Region', 'ER'],
  ['reg-accra', 'Greater Accra Region', 'GAR'],
  ['reg-north-east', 'North East Region', 'NER'],
  ['reg-northern', 'Northern Region', 'NR'],
  ['reg-oti', 'Oti Region', 'OR'],
  ['reg-savannah', 'Savannah Region', 'SR'],
  ['reg-upper-east', 'Upper East Region', 'UER'],
  ['reg-upper-west', 'Upper West Region', 'UWR'],
  ['reg-volta', 'Volta Region', 'VR'],
  ['reg-western', 'Western Region', 'WR'],
  ['reg-western-north', 'Western North Region', 'WNR'],
];

// Starter district per new region (capital). Ashanti/Central/Accra already seeded.
const CAPITAL_DISTRICTS = [
  ['dist-ahafo-agogo', 'Ahafo Goaso', 'AGO', 'reg-ahafo'],
  ['reg-bono', 'Sunyani Municipal', 'SUN', 'reg-bono'],
  ['reg-bono-east', 'Techiman Municipal', 'TEC', 'reg-bono-east'],
  ['reg-eastern', 'New Juaben North', 'NJN', 'reg-eastern'],
  ['reg-north-east', 'Yunyoo-Nasuan', 'YUN', 'reg-north-east'],
  ['reg-northern', 'Tamale Metropolitan', 'TML', 'reg-northern'],
  ['reg-oti', 'Nkwanta South', 'NKS', 'reg-oti'],
  ['reg-savannah', 'Bole District', 'BOL', 'reg-savannah'],
  ['reg-upper-east', 'Bolgatanga Municipal', 'BOG', 'reg-upper-east'],
  ['reg-upper-west', 'Wa Municipal', 'WA', 'reg-upper-west'],
  ['reg-volta', 'Ho Municipal', 'HO', 'reg-volta'],
  ['reg-western', 'Sekondi-Takoradi Metropolitan', 'SKT', 'reg-western'],
  ['reg-western-north', 'Sefwi Wiawso', 'SFS', 'reg-western-north'],
];

async function run() {
  console.log('--- FIELD OPS TABLES ---');

  await sql`
    CREATE TABLE IF NOT EXISTS field_groups (
      id text PRIMARY KEY,
      region_id text NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
      name text NOT NULL,
      leader_officer_id text REFERENCES "user"(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log('field_groups ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS daily_school_assignments (
      id text PRIMARY KEY,
      group_id text REFERENCES field_groups(id) ON DELETE SET NULL,
      officer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      center_id text NOT NULL REFERENCES examination_centers(id) ON DELETE CASCADE,
      date text NOT NULL,
      assigned_by text NOT NULL,
      source text NOT NULL DEFAULT 'leader',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS daily_school_assignments_officer_date
    ON daily_school_assignments (officer_id, date)
  `;
  console.log('daily_school_assignments ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS arrival_events (
      id text PRIMARY KEY,
      officer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      center_id text REFERENCES examination_centers(id) ON DELETE SET NULL,
      assignment_id text REFERENCES daily_school_assignments(id) ON DELETE SET NULL,
      kind text NOT NULL,
      phone_time timestamptz,
      server_time timestamptz NOT NULL DEFAULT now(),
      lat numeric(10, 7),
      lng numeric(10, 7),
      accuracy_m integer,
      source text NOT NULL DEFAULT 'auto',
      accuracy_tier text,
      note text,
      confirmed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS arrival_events_officer_date
    ON arrival_events (officer_id, server_time DESC)
  `;
  console.log('arrival_events ✓');

  await sql`
    CREATE TABLE IF NOT EXISTS monitored_papers (
      id text PRIMARY KEY,
      operation_id text NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      paper_id text NOT NULL REFERENCES exam_timetable(id) ON DELETE CASCADE,
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS monitored_papers_unique
    ON monitored_papers (operation_id, paper_id)
  `;
  console.log('monitored_papers ✓');

  // group membership on user
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS group_id text REFERENCES field_groups(id) ON DELETE SET NULL`;
  console.log('user.group_id ✓');

  console.log('--- SEED REGIONS ---');
  for (const [id, name, code] of REGIONS) {
    const r = await sql`
      INSERT INTO regions (id, name, code, country_code)
      VALUES (${id}, ${name}, ${code}, 'GH')
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    console.log(id + ':', r.length ? 'seeded' : 'already existed');
  }

  console.log('--- SEED CAPITAL DISTRICTS ---');
  for (const [id, name, code, regionId] of CAPITAL_DISTRICTS) {
    const fixedId = id.startsWith('reg-') ? 'dist-' + id.slice(4) : id;
    const r = await sql`
      INSERT INTO districts (id, name, code, region_id)
      VALUES (${fixedId}, ${name}, ${code}, ${regionId})
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    console.log(fixedId + ':', r.length ? 'seeded' : 'already existed');
  }

  console.log('Migration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
