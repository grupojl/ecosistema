// Prepara la base DESCARTABLE de los tests de integración (DT-TEST-03). Nunca toca otra base.
//
//   ADMIN_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres node scripts/test-db-setup.mjs
//
// 1. (re)crea la base `realsass_ecommerce_test`
// 2. aplica las migraciones de Prisma
// 3. activa RLS (prisma/rls/enable-rls.sql)
// 4. crea el rol `rls_app` SIN superusuario: un superusuario ignora RLS aunque esté forzado, y la app real no lo es.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adminUrl = process.env.ADMIN_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';
const DB = 'realsass_ecommerce_test';
const u = new URL(adminUrl);
const testUrl = (user, pass) => `postgresql://${user}:${pass}@${u.host}/${DB}`;
const superUrl = testUrl(decodeURIComponent(u.username), decodeURIComponent(u.password));

if (!/localhost|127\.0\.0\.1/.test(u.hostname)) {
  console.error('Por seguridad este script solo corre contra un Postgres local.');
  process.exit(1);
}

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${DB}`);
await admin.end();

execSync('npx prisma migrate deploy', { cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_URL: superUrl } });

const db = new pg.Client({ connectionString: superUrl });
await db.connect();
await db.query(readFileSync(resolve(root, 'prisma/rls/enable-rls.sql'), 'utf8'));
await db.query(`DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rls_app') THEN CREATE ROLE rls_app LOGIN PASSWORD 'rls_app'; END IF;
END $$`);
await db.query(`GRANT CONNECT ON DATABASE ${DB} TO rls_app`);
await db.query('GRANT USAGE ON SCHEMA public TO rls_app');
await db.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rls_app');
await db.end();

console.log(`\nListo. TEST_DATABASE_URL=${superUrl}\n       TEST_APP_DATABASE_URL=${testUrl('rls_app', 'rls_app')}`);
