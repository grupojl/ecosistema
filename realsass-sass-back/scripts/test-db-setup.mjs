// Prepara la base DESCARTABLE de los tests de integración de sass-back (DT-TEST-13). Nunca toca otra base.
//
//   ADMIN_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres node scripts/test-db-setup.mjs
//
// (re)crea `realsass_sass_test` y aplica las migraciones de Prisma. sass-back no usa RLS: el aislamiento entre
// organizaciones es el filtro por organizationId de cada repositorio, que es justo lo que estos tests verifican.
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adminUrl = process.env.ADMIN_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';
const DB = 'realsass_sass_test';
const u = new URL(adminUrl);
u.pathname = `/${DB}`;
const testUrl = u.toString();

if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(adminUrl).hostname)) {
  console.error('Por seguridad este script solo corre contra un Postgres local.');
  process.exit(1);
}

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${DB}`);
await admin.end();

execSync('npx prisma migrate deploy', { cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_URL: testUrl } });
console.log(`\nListo. TEST_DATABASE_URL=${testUrl}`);
