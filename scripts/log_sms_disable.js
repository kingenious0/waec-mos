const path = require('path');
const fs = require('fs');
const { neon } = require(path.resolve('node_modules/@neondatabase/serverless'));
const env = fs.readFileSync('.env', 'utf-8');
const match = env.match(/DATABASE_URL=([^\r\n]+)/);
const sql = neon(match[1].trim());

async function run() {
  const id = `aud-${Date.now()}-emergency`;
  await sql`
    INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, is_read, created_at)
    VALUES (
      ${id},
      'system-emergency',
      'Emergency access',
      'SYSTEM',
      'SETTINGS_UPDATED',
      'system_settings',
      'default-ashanti',
      ${JSON.stringify({ message: 'Admin SMS 2FA was disabled via direct database action because no SMS provider is configured and super-admin was locked out.', adminSmsCheck: false })}::jsonb,
      false,
      NOW()
    )
  `;
  console.log('audit entry written', id);
}
run().catch((e) => { console.error(e); process.exit(1); });
