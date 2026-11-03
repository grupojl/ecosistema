import type { Page } from '@playwright/test';
import pg from 'pg';
import { dbUrl, STORE_SLUG } from '../../setup/constants.mjs';
import { expect } from './diagnostics';
import { signInWithGoogleViaEmulator, uniqueEmail } from './emulator';

export const home = `/es/${STORE_SLUG}`;

export async function ecommerceQuery<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  const db = new pg.Client({ connectionString: dbUrl('welver_ecommerce_e2e') });
  await db.connect();
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.end();
  }
}

/** Ingresa con una cuenta NUEVA del emulador desde el diálogo de ingreso de la tienda. Devuelve su email. */
export async function signInAsNewCustomer(page: Page, email = uniqueEmail('cliente')): Promise<string> {
  await signInWithGoogleViaEmulator(page, () => page.getByRole('button', { name: /Continuar con Google/ }).click(), email);
  await expect(page.getByRole('dialog')).toBeHidden();
  return email;
}

/** Cliente nuevo: ingresa, agrega la zapatilla, confirma el pedido. Devuelve el email y el id de SU pedido. */
export async function buyOneAsNewCustomer(page: Page): Promise<{ email: string; orderId: string }> {
  await page.goto(`${home}/productos/zapatilla-urbana`);
  await page.getByRole('button', { name: 'Agregar a la bolsa' }).click();
  await expect(page.getByRole('dialog')).toContainText('Ingresá a tu cuenta');
  const email = await signInAsNewCustomer(page);
  await expect(page.getByText('Agregado a tu bolsa')).toBeVisible();

  await page.goto(`${home}/checkout`);
  await page.getByLabel('Calle y número').fill('Av. Siempreviva 742');
  await page.getByLabel('Ciudad').fill('Rosario');
  await page.getByLabel('Código postal').fill('2000');
  await page.getByLabel('País').fill('AR');
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByText('Pedido recibido')).toBeVisible();

  const rows = await ecommerceQuery<{ id: string }>(
    `SELECT o.id FROM orders o JOIN store_customers c ON c.id = o.customer_id WHERE c.email = $1`,
    [email],
  );
  expect(rows).toHaveLength(1);
  return { email, orderId: rows[0]!.id };
}
