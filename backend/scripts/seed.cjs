// backend/scripts/seed.cjs
//
// Local/dev-only seed data: wipes users/sessions and inserts one demo user per
// role (admin/teacher/student) so there's something to log in as. Never run
// against production.
//
// Usage: npm run seed (reads DATABASE_URL from backend/.env)

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const DEMO_PASSWORD = 'password123';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE users, sessions RESTART IDENTITY CASCADE');

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const users = [
      { role: 'admin', email: 'admin@classeshub.test', name: 'Admin User' },
      { role: 'teacher', email: 'teacher@classeshub.test', name: 'Teacher User' },
      { role: 'student', email: 'student@classeshub.test', name: 'Student User' },
    ];
    for (const u of users) {
      await client.query(`INSERT INTO users (role, email, password_hash, name) VALUES ($1, $2, $3, $4)`, [
        u.role,
        u.email,
        passwordHash,
        u.name,
      ]);
    }

    await client.query('COMMIT');

    console.log('Seed complete.\n');
    console.log('Login credentials (all passwords: %s):', DEMO_PASSWORD);
    for (const u of users) console.log('  %s  %s', u.role.padEnd(8), u.email);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
