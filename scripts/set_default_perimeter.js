/** One-time data fix: pin the hub default geofence radius to 150 m
 *  (the app-wide code default) to end the 150/300 split. Per-center radii
 *  (e.g. Winneba's 300 m) are left untouched. */
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
  const before = await sql`SELECT "id", "geofence_radius" FROM "system_settings"`;
  console.log('Before:', before);
  await sql`
    UPDATE "system_settings"
    SET "geofence_radius" = '150 m', "updated_at" = NOW()
    WHERE "id" = 'default-ashanti'
  `;
  const after = await sql`SELECT "id", "geofence_radius" FROM "system_settings"`;
  console.log('After:', after);
}

run().catch((err) => {
  console.error('Fix failed:', err);
  process.exit(1);
});
