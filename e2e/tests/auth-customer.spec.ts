/**
 * Flujo del CLIENTE de la tienda con sesión (ADR-021) contra el stack real + emulador de Firebase Auth:
 * ingresar con Google, armar la bolsa, confirmar el pedido y verlo en «Mis pedidos». Verifica el efecto en la base:
 * orden creada, stock reservado y evento en el outbox.
 */
import { expect, test } from './helpers/diagnostics';
import pg from 'pg';
import { ORG_ID, STORE_SLUG, dbUrl } from '../setup/constants.mjs';
import { signInWithGoogleViaEmulator } from './helpers/emulator';

const home = `/es/${STORE_SLUG}`;

async function query<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  const db = new pg.Client({ connectionString: dbUrl('welver_ecommerce_e2e') });
  await db.connect();
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.end();
  }
}

test('el cliente ingresa, compra y ve su pedido (con efectos reales en la base)', async ({ page }) => {
  // El estado previo: el test es relativo, así que no depende de que la base esté vacía (p. ej. con --repeat-each)
  const [{ stock_before, reserved_before }] = await query<{ stock_before: number; reserved_before: number }>(
    `SELECT quantity_available AS stock_before, quantity_reserved AS reserved_before FROM inventory_items i JOIN product_variants v ON v.id = i.variant_id WHERE v.sku = 'sku-zapatilla-urbana'`,
  );
  const knownOrders = (await query<{ id: string }>(`SELECT id FROM orders WHERE organization_id = $1`, [ORG_ID])).map((o) => o.id);

  await page.goto(`${home}/productos/zapatilla-urbana`);
  await page.getByRole('button', { name: 'Agregar a la bolsa' }).click();

  // Sin sesión, pide ingresar
  await expect(page.getByRole('dialog')).toContainText('Ingresá a tu cuenta');
  await signInWithGoogleViaEmulator(page, () => page.getByRole('button', { name: /Continuar con Google/ }).click());
  await expect(page.getByRole('dialog')).toBeHidden();

  // Al ingresar se completa solo lo que quería hacer (agregar UNA unidad; no hay que volver a hacer clic)
  await expect(page.getByText('Agregado a tu bolsa')).toBeVisible();

  // Checkout
  await page.goto(`${home}/checkout`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Finalizar compra');
  await page.getByLabel('Calle y número').fill('Av. Siempreviva 742');
  await page.getByLabel('Ciudad').fill('Rosario');
  await page.getByLabel('Código postal').fill('2000');
  await page.getByLabel('País').fill('AR');
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByText('Pedido recibido')).toBeVisible();

  // Efectos reales: una orden con el total correcto, stock reservado y el evento en el outbox
  const orders = (
    await query<{ id: string; total_cents: number; status: string }>(
      `SELECT id, total_cents, status FROM orders WHERE organization_id = $1`, [ORG_ID],
    )
  ).filter((o) => !knownOrders.includes(o.id));
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({ total_cents: 1500000, status: 'PENDING_PAYMENT' });
  const [{ stock_after, reserved }] = await query<{ stock_after: number; reserved: number }>(
    `SELECT quantity_available AS stock_after, quantity_reserved AS reserved FROM inventory_items i JOIN product_variants v ON v.id = i.variant_id WHERE v.sku = 'sku-zapatilla-urbana'`,
  );
  expect(stock_after).toBe(stock_before - 1);
  expect(reserved).toBe(reserved_before + 1);
  const events = await query<{ type: string }>(`SELECT type FROM outbox_events WHERE aggregate_id = $1`, [orders[0]!.id]);
  expect(events.map((e) => e.type)).toEqual(['order.created']);

  // «Mis pedidos»
  await page.goto(`${home}/pedidos`);
  await expect(page.getByText(`#${orders[0]!.id.slice(0, 8)}`)).toBeVisible();
  await expect(page.getByText('Pendiente de pago')).toBeVisible();
});

test('un producto sin stock no ofrece agregar a la bolsa', async ({ page }) => {
  await page.goto(`${home}/productos/bota-de-cuero`);
  await expect(page.getByText('Sin stock')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agregar a la bolsa' })).toHaveCount(0);
});
