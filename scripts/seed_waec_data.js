const path = require('path');
const { neon } = require(path.resolve('node_modules/@neondatabase/serverless'));
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
if (!match) {
  console.error('No DATABASE_URL found');
  process.exit(1);
}
const sql = neon(match[1].trim());

async function seed() {
  console.log('--- SEEDING FOUNDATIONAL WAEC RECORDS TO NEON POSTGRESQL ---');

  // 1. Regions
  console.log('Seeding Regions...');
  await sql`
    INSERT INTO "regions" ("id", "name", "code", "country_code")
    VALUES 
      ('reg-ashanti', 'Ashanti Region', 'AR', 'GH'),
      ('reg-accra', 'Greater Accra Region', 'GAR', 'GH')
    ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name";
  `;

  // 2. Districts
  console.log('Seeding Districts...');
  await sql`
    INSERT INTO "districts" ("id", "region_id", "name", "code")
    VALUES 
      ('dist-kumasi-metro', 'reg-ashanti', 'Kumasi Metropolitan', 'KMA'),
      ('dist-bantama', 'reg-ashanti', 'Bantama Sub-Metro', 'BAN'),
      ('dist-asokwa', 'reg-ashanti', 'Asokwa Municipal', 'ASK'),
      ('dist-kwadaso', 'reg-ashanti', 'Kwadaso Municipal', 'KWA')
    ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name";
  `;

  // 3. Operations
  console.log('Seeding Active Operation...');
  await sql`
    INSERT INTO "operations" ("id", "name", "series_year", "start_date", "end_date", "status")
    VALUES 
      ('op-wassce-2026', 'WASSCE SC 2026 - Main Series', 2026, '2026-05-01 00:00:00', '2026-06-30 23:59:59', 'ACTIVE')
    ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "status" = EXCLUDED."status";
  `;

  // 4. Examination Centers
  console.log('Seeding Examination Centers...');
  await sql`
    INSERT INTO "examination_centers" 
      ("id", "center_code", "center_name", "district_id", "latitude", "longitude", "geofence_radius_meters", "supervisor_contact")
    VALUES 
      ('cnt-050102', '050102', 'Prempeh College Center A', 'dist-bantama', 6.7028, -1.6369, 150, '+233 24 411 0001'),
      ('cnt-050510', '050510', 'Yaa Asantewaa Girls Center 2', 'dist-kwadaso', 6.6912, -1.6521, 150, '+233 24 411 0002'),
      ('cnt-050211', '050211', 'Kumasi High School Center 1', 'dist-asokwa', 6.6663, -1.5975, 150, '+233 24 411 0003'),
      ('cnt-050304', '050304', 'Opoku Ware School Center A', 'dist-kumasi-metro', 6.6806, -1.6389, 150, '+233 24 411 0004')
    ON CONFLICT ("id") DO UPDATE 
      SET "center_name" = EXCLUDED."center_name",
          "latitude" = EXCLUDED."latitude",
          "longitude" = EXCLUDED."longitude";
  `;

  // 5. Users
  console.log('Seeding Verified Personnel (2 field officers)...');
  await sql`
    INSERT INTO "public"."user" 
      ("id", "name", "email", "role", "staff_id", "phone", "pin", "group_name", "is_group_leader", "status", "region_id", "must_change_password")
    VALUES 
      ('usr-admin-hq', 'Dr. James Addo', 'admin@waec.org', 'SUPER_ADMIN', 'WAEC-HQ-001', '+233 24 111 2233', '0001', 'HQ Command', true, 'ACTIVE', 'reg-ashanti', false),
      ('usr-off-0101', 'Kofi Mensah', 'kmensah@waec.org', 'FIELD_OFFICER', 'WAEC-ASH-0101', '+233 24 410 1001', '0412', 'Group 1', true, 'ACTIVE', 'reg-ashanti', false),
      ('usr-off-0102', 'Akua Owusu', 'aowusu@waec.org', 'FIELD_OFFICER', 'WAEC-ASH-0102', '+233 24 410 1002', '1234', 'Group 1', false, 'ACTIVE', 'reg-ashanti', false)
    ON CONFLICT ("id") DO UPDATE 
      SET "name" = EXCLUDED."name",
          "role" = EXCLUDED."role",
          "phone" = EXCLUDED."phone",
          "pin" = EXCLUDED."pin",
          "group_name" = EXCLUDED."group_name",
          "is_group_leader" = EXCLUDED."is_group_leader",
          "status" = EXCLUDED."status";
  `;

  // 6. Assignments
  console.log('Seeding Operational Assignments...');
  await sql`
    INSERT INTO "assignments"
      ("id", "operation_id", "center_id", "officer_id", "date", "paper_name", "start_time", "end_time", "status", "check_in_time", "check_in_distance_meters")
    VALUES
      ('asg-01', 'op-wassce-2026', 'cnt-050102', 'usr-off-0101', '2026-05-12', 'Core Mathematics Paper 1 & 2', '08:30 GMT', '12:00 GMT', 'ON_SITE', '2026-05-12 07:54:00', 24),
      ('asg-02', 'op-wassce-2026', 'cnt-050102', 'usr-off-0102', '2026-05-12', 'Core Mathematics Paper 1 & 2', '08:30 GMT', '12:00 GMT', 'ON_SITE', '2026-05-12 08:02:00', 45)
    ON CONFLICT ("id") DO UPDATE
      SET "status" = EXCLUDED."status",
          "check_in_time" = EXCLUDED."check_in_time";
  `;

  console.log('✓ SEEDING COMPLETED SUCCESSFULLY IN NEON POSTGRESQL!');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
