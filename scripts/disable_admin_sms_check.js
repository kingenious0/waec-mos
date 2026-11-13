const path = require('path');
const fs = require('fs');
const { neon } = require(path.resolve('node_modules/@neondatabase/serverless'));
const env = fs.readFileSync('.env', 'utf-8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
const sql = neon(match[1].trim());

async function run() {
  const before = await sql`SELECT id, admin_sms_check FROM system_settings WHERE id = 'default-ashanti'`;
  console.log('before:', before);
  await sql`
    UPDATE system_settings
    SET admin_sms_check = false, updated_at = NOW(), updated_by = 'emergency-access'
    WHERE id = 'default-ashanti'
  `;
  const after = await sql`SELECT id, admin_sms_check, updated_at, updated_by FROM system_settings WHERE id = 'default-ashanti'`;
  console.log('after:', after);
}
run().catch((e) => { console.error(e); process.exit(1); });
