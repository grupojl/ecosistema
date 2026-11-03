// Prepara la base DESCARTABLE de un back para los e2e y la siembra con datos conocidos.
//
//   node e2e/setup/prepare.mjs sass        → welver_sass_e2e       (usuario + organización con slug e2e-tienda)
//   node e2e/setup/prepare.mjs ecommerce   → welver_ecommerce_e2e  (catálogo e inventario de esa organización)
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
  ecommerce: { db: 'welver_ecommerce_e2e', dir: 'realsass-ecommerce-back' },
};
const target = TARGETS[which];
if (!target) throw new Error('Uso: prepare.mjs sass|ecommerce');
if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(adminUrl).hostname)) throw new Error('Solo contra un Postgres local');

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${target.db} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${target.db}`);
await admin.end();

execSync('npx prisma migrate deploy', { cwd: resolve(root, target.dir), stdio: 'inherit', env: { ...process.env, DATABASE_URL: dbUrl(target.db) } });

const db = new pg.Client({ connectionString: dbUrl(target.db) });
await db.connect();
if (which === 'sass') {
  await db.query(
    `INSERT INTO users (id, "firebaseUid", email, "isOwner", "displayName", "updatedAt")
     VALUES ('00000000-0000-4000-8000-000000000001', 'e2e-owner', 'dueno@e2e.test', true, 'Dueño E2E', now())`,
  );
  await db.query(
    `INSERT INTO organizations (id, "userId", name, description, slug, country_code, "updatedAt")
     VALUES ($1, '00000000-0000-4000-8000-000000000001', 'Tienda E2E', 'Tienda de pruebas de punta a punta', $2, 'AR', now())`,
    [ORG_ID, STORE_SLUG],
  );
} else {
  const cat = await db.query(
    `INSERT INTO categories (id, organization_id, name, handle, updated_at) VALUES (gen_random_uuid(), $1, 'Calzado', 'calzado', now()) RETURNING id`,
    [ORG_ID],
  );
  const products = [
    { name: 'Zapatilla Urbana', handle: 'zapatilla-urbana', price: 1500000, stock: 5, description: 'Cómoda y liviana para todo el día.' },
    { name: 'Bota de Cuero', handle: 'bota-de-cuero', price: 2200000, stock: 0, description: 'Cuero genuino.' },
  ];
  for (const p of products) {
    const prod = await db.query(
      `INSERT INTO products (id, organization_id, category_id, name, handle, description, status, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'PUBLISHED', now()) RETURNING id`,
      [ORG_ID, cat.rows[0].id, p.name, p.handle, p.description],
    );
    const variant = await db.query(
      `INSERT INTO product_variants (id, product_id, organization_id, sku, title, price_cents, currency, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'Único', $4, 'ARS', now()) RETURNING id`,
      [prod.rows[0].id, ORG_ID, `sku-${p.handle}`, p.price],
    );
    await db.query(
      `INSERT INTO inventory_items (id, variant_id, organization_id, quantity_available, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, now())`,
      [variant.rows[0].id, ORG_ID, p.stock],
    );
  }
}
await db.end();
console.log(`[e2e] ${target.db} lista`);
