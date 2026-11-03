/**
 * Flujo del DUEÑO contra el stack real + emulador de Firebase Auth (ADR-004, ADR-020):
 *   · ingresar con Google en sass-front → se crea el usuario y su organización por defecto (auth.sync)
 *   · la cookie __session es la sesión compartida: el dashboard-front (otro origen) entra sin volver a pedir login
 *   · «Dispositivos» lista la sesión actual y «Cerrar sesión» la termina en TODOS los fronts
 */
import type { Page } from '@playwright/test';
import { expect, test } from './helpers/diagnostics';
import pg from 'pg';
import { PORTS, dbUrl } from '../setup/constants.mjs';
import { signInExistingViaEmulator, signInWithGoogleViaEmulator, uniqueEmail } from './helpers/emulator';

const SASS_FRONT = `http://localhost:${PORTS.sassFront}`;
const DASHBOARD = `http://localhost:${PORTS.dashboardFront}`;

async function sassQuery<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  const db = new pg.Client({ connectionString: dbUrl('welver_sass_e2e') });
  await db.connect();
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.end();
  }
}

async function loginInSassFront(page: Page, email: string) {
  await page.goto(SASS_FRONT);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await signInWithGoogleViaEmulator(page, () => page.getByRole('button', { name: /Continuar con Google/ }).click(), email);
}

test('el dueño ingresa, comparte la sesión con el dashboard y la cierra desde «Dispositivos»', async ({ page }) => {
  const email = uniqueEmail('dueno');
  await loginInSassFront(page, email);

  // auth.sync creó al usuario y su organización por defecto, y la cookie de sesión quedó puesta
  await expect(async () => {
    const rows = await sassQuery<{ org_name: string }>(
      `SELECT o.name AS org_name FROM users u JOIN organizations o ON o."userId" = u.id WHERE u.email = $1`, [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.org_name).toContain('Persona E2E');
  }).toPass({ timeout: 20_000 });
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === '__session' && c.httpOnly)).toBe(true);

  // Sesión compartida: el dashboard (otro origen) entra SIN pedir login
  await page.goto(DASHBOARD);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible({ timeout: 30_000 });

  // «Dispositivos» (menú del usuario): aparece este equipo y se puede cerrar la sesión
  await page.getByRole('button', { name: 'Menú de cuenta' }).click();
  await page.getByRole('menuitem', { name: /Dispositivos/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Dispositivos' });
  await expect(dialog.getByText('Este dispositivo')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);

  // La sesión terminó en TODOS los fronts: sass-front vuelve a mostrar «Iniciar sesión»
  await page.goto(SASS_FRONT);
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible({ timeout: 30_000 });
  expect((await page.context().cookies()).some((c) => c.name === '__session')).toBe(false);
});

test('desde «Dispositivos» el dueño cierra OTRA sesión y ese dispositivo queda fuera', async ({ page, browser }) => {
  const email = uniqueEmail('dueno-2');

  // Dispositivo A: ingresa y abre el dashboard
  await loginInSassFront(page, email);
  await page.goto(DASHBOARD);
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible({ timeout: 30_000 });

  // Dispositivo B: otro navegador, misma cuenta
  const contextB = await browser.newContext({ locale: 'es-AR' });
  const deviceB = await contextB.newPage();
  await deviceB.goto(`${DASHBOARD}/login`);
  await signInExistingViaEmulator(deviceB, () => deviceB.getByRole('button', { name: /Continuar con Google/ }).click(), email);
  await expect(deviceB.getByRole('heading', { name: 'Resumen' })).toBeVisible({ timeout: 30_000 });

  // La cookie de B ANTES de que A la cierre
  const cookiesB = await contextB.cookies();
  expect(cookiesB.some((c) => c.name === '__sid')).toBe(true);
  expect((await fetch(`http://localhost:${PORTS.sass}/api/v1/trpc/auth.me`, { headers: { cookie: cookiesB.map((c) => `${c.name}=${c.value}`).join('; ') } })).status).toBe(200);

  // En A aparecen dos sesiones; se cierra la otra
  await page.getByRole('button', { name: 'Menú de cuenta' }).click();
  await page.getByRole('menuitem', { name: /Dispositivos/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Dispositivos' });
  // (la X del diálogo también se llama «Cerrar»: se acota a las filas de dispositivos)
  const rows = dialog.locator('.rounded-lg.border');
  await expect(rows).toHaveCount(2, { timeout: 15_000 });
  const otherRow = rows.filter({ hasNot: page.getByText('Este dispositivo') });
  await otherRow.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(rows).toHaveCount(1, { timeout: 15_000 });
  await expect(rows.first().getByText('Este dispositivo')).toBeVisible();

  // La cookie del dispositivo B (la que tenía ANTES de cerrarla) ya no sirve en el back
  const cookieHeader = cookiesB.map((c) => `${c.name}=${c.value}`).join('; ');
  const meWithOldCookie = await fetch(`http://localhost:${PORTS.sass}/api/v1/trpc/auth.me`, { headers: { cookie: cookieHeader } });
  expect(meWithOldCookie.status).toBe(401);

  // El dispositivo B queda fuera de verdad: al recargar NO re-crea su cookie con el login que se cerró (ADR-020)
  await deviceB.reload();
  await expect(deviceB).toHaveURL(/\/login/, { timeout: 30_000 });
  expect((await contextB.cookies()).some((c) => c.name === '__session' && c.value !== '')).toBe(false);

  // Y puede volver a entrar con un login NUEVO (la revocación no bloquea la cuenta)
  await signInExistingViaEmulator(deviceB, () => deviceB.getByRole('button', { name: /Continuar con Google/ }).click(), email);
  await expect(deviceB.getByRole('heading', { name: 'Resumen' })).toBeVisible({ timeout: 30_000 });

  // A sigue con su sesión
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible({ timeout: 30_000 });
  await contextB.close();
});
