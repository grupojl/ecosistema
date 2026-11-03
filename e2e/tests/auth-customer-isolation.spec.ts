/**
 * Aislamiento entre clientes del storefront y cierre de sesión (ADR-021), en un navegador real contra el stack real.
 * Lo que se verifica es la invariante del negocio: un cliente NUNCA ve ni toca los pedidos de otro, ni con la UI ni
 * llamando al back directamente con su propia sesión.
 */
import { expect, test } from './helpers/diagnostics';
import { PORTS, ORG_ID } from '../setup/constants.mjs';
import { emulatorIdToken } from './helpers/emulator';
import { buyOneAsNewCustomer, ecommerceQuery, home, signInAsNewCustomer } from './helpers/storefront';

const ECOMMERCE = `http://localhost:${PORTS.ecommerce}`;

test('un cliente no ve los pedidos de otro (ni por la UI ni por el back)', async ({ page, browser }) => {
  // Cliente 1 compra
  const first = await buyOneAsNewCustomer(page);

  // Cliente 2: otro navegador, otra cuenta
  const context2 = await browser.newContext({ locale: 'es-AR' });
  const page2 = await context2.newPage();
  await page2.goto(`${home}/pedidos`);
  await page2.getByRole('button', { name: 'Ingresar' }).first().click();
  const email2 = await signInAsNewCustomer(page2);

  // UI: su lista está vacía y el id del pedido ajeno no aparece
  await expect(page2.getByText('Todavía no hiciste pedidos.')).toBeVisible({ timeout: 20_000 });
  await expect(page2.locator('body')).not.toContainText(first.orderId.slice(0, 8));

  // Back: con SU propia sesión, pedir el detalle del pedido ajeno por id es NOT_FOUND (no revela que existe)
  const call = async (token: string) =>
    fetch(`${ECOMMERCE}/api/v1/trpc/customer.orderDetail?input=${encodeURIComponent(JSON.stringify({ orderId: first.orderId }))}`, {
      headers: { authorization: `Bearer ${token}`, 'x-organization-id': ORG_ID },
    });
  const asSecond = await call(await emulatorIdToken(email2));
  expect(asSecond.status).toBe(404);
  const asOwner = await call(await emulatorIdToken(first.email));
  expect(asOwner.status).toBe(200); // control: el dueño del pedido sí lo ve (el 404 de arriba no es un endpoint roto)

  // En la base el pedido sigue siendo SOLO del cliente 1
  const owners = await ecommerceQuery<{ email: string }>(
    `SELECT c.email FROM orders o JOIN store_customers c ON c.id = o.customer_id WHERE o.id = $1`,
    [first.orderId],
  );
  expect(owners).toEqual([{ email: first.email }]);
  await context2.close();
});

test('cerrar sesión desde la cuenta del storefront vuelve a pedir ingreso', async ({ page }) => {
  await page.goto(`${home}/productos/zapatilla-urbana`);
  await page.getByRole('button', { name: 'Agregar a la bolsa' }).click();
  await signInAsNewCustomer(page);
  await expect(page.getByText('Agregado a tu bolsa')).toBeVisible();

  await page.getByRole('button', { name: /^Cuenta/ }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  await page.goto(`${home}/pedidos`);
  await expect(page.getByText('Ingresá para')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Todavía no hiciste pedidos.')).toHaveCount(0);
});
