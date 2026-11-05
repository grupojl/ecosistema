// Prepara la base DESCARTABLE de un back para los e2e y la siembra con datos conocidos.
//
//   node e2e/setup/prepare.mjs sass        → welver_sass_e2e       (usuario + municipio de prueba)
//
// Nunca toca otra base ni un servidor remoto: se niega a correr si el host no es local.
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { ORG_ID, STORE_SLUG, adminUrl, dbUrl } from './constants.mjs';

const which = process.argv[2];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TARGETS = {
  sass: { db: 'welver_sass_e2e', dir: 'realsass-sass-back' },
};
const target = TARGETS[which];
if (!target) throw new Error('Uso: prepare.mjs sass');
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(adminUrl).hostname)) throw new Error('Solo contra un Postgres local');

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${target.db} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${target.db}`);
await admin.end();

execSync('npx prisma migrate deploy', { cwd: resolve(root, target.dir), stdio: 'inherit', env: { ...process.env, DATABASE_URL: dbUrl(target.db) } });

const db = new pg.Client({ connectionString: dbUrl(target.db) });
await db.connect();
await db.query(
  `INSERT INTO users (id, "firebaseUid", email, "isOwner", "displayName", "updatedAt")
   VALUES ('00000000-0000-4000-8000-000000000001', 'e2e-owner', 'dueno@e2e.test', true, 'Dueño E2E', now())`,
);
await db.query(
  `INSERT INTO organizations (id, "userId", name, description, slug, country_code, "updatedAt")
   VALUES ($1, '00000000-0000-4000-8000-000000000001', 'Municipio E2E', 'Municipio de pruebas de punta a punta', $2, 'AR', now())`,
  [ORG_ID, STORE_SLUG],
);
await db.end();
console.log(`[e2e] ${target.db} lista`);
