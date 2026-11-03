/**
 * Programa de referidos (D2) contra el stack real: todo usuario nace con su perfil de afiliado, y quien se registra desde
 * el enlace `?ref=<código>` queda asentado como referido y suma al contador de quien lo invitó.
 * Encontró dos huecos: nunca se creaba la fila AffiliateData (el contador no sumaba) y el usuario nuevo no guardaba
 * `referredByCode` (la lista de referidos salía siempre vacía).
 */
import pg from 'pg';
import { expect, test } from './helpers/diagnostics';
import { PORTS, dbUrl } from '../setup/constants.mjs';
import { signInWithGoogleViaEmulator, uniqueEmail } from './helpers/emulator';

const SASS_FRONT = `http://localhost:${PORTS.sassFront}`;

async function sassQuery<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
  const db = new pg.Client({ connectionString: dbUrl('welver_sass_e2e') });
  await db.connect();
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.end();
  }
}

test('quien se registra con el enlace de un afiliado queda como su referido y suma a su contador', async ({ page, browser }) => {
  // Afiliado A: ingresa y tiene su código y su perfil
  const emailA = uniqueEmail('afiliado');
  await page.goto(SASS_FRONT);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await signInWithGoogleViaEmulator(page, () => page.getByRole('button', { name: /Continuar con Google/ }).click(), emailA);

  let code = '';
  await expect(async () => {
    const rows = await sassQuery<{ code: string | null; count: number | null }>(
      `SELECT u."affiliateCode" AS code, a."referralCount" AS count FROM users u LEFT JOIN affiliate_data a ON a."userId" = u.id WHERE u.email = $1`,
      [emailA],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.code).toMatch(/^ref-[0-9a-f]{10}$/); // aleatorio, no derivado del uid
    expect(rows[0]!.count).toBe(0); // el perfil de afiliado EXISTE (antes nunca se creaba)
    code = rows[0]!.code!;
  }).toPass({ timeout: 20_000 });

  // Su enlace de invitación aparece en /profile
  await page.goto(`${SASS_FRONT}/profile`);
  await expect(page.getByText(`/?ref=${code}`)).toBeVisible({ timeout: 20_000 });

  // Persona B: otro navegador, entra por el enlace con ?ref=
  const contextB = await browser.newContext({ locale: 'es-AR' });
  const pageB = await contextB.newPage();
  const emailB = uniqueEmail('invitado');
  await pageB.goto(`${SASS_FRONT}/?ref=${code}`);
  await pageB.getByRole('button', { name: 'Iniciar sesión' }).click();
  await signInWithGoogleViaEmulator(pageB, () => pageB.getByRole('button', { name: /Continuar con Google/ }).click(), emailB);

  await expect(async () => {
    const [b] = await sassQuery<{ ref: string | null }>(`SELECT "referredByCode" AS ref FROM users WHERE email = $1`, [emailB]);
    expect(b?.ref).toBe(code); // quedó asentado quién lo invitó
    const [a] = await sassQuery<{ count: number }>(
      `SELECT a."referralCount" AS count FROM affiliate_data a JOIN users u ON u.id = a."userId" WHERE u.email = $1`,
      [emailA],
    );
    expect(a?.count).toBe(1); // y el contador de A sumó
  }).toPass({ timeout: 20_000 });

  // Un segundo ingreso de B (otro dispositivo / recarga) NO vuelve a sumar: solo cuenta el alta
  await pageB.reload();
  await pageB.waitForTimeout(1500);
  const [again] = await sassQuery<{ count: number }>(
    `SELECT a."referralCount" AS count FROM affiliate_data a JOIN users u ON u.id = a."userId" WHERE u.email = $1`,
    [emailA],
  );
  expect(again?.count).toBe(1);
  await contextB.close();
});
