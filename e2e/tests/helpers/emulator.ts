import { expect, type Page } from '@playwright/test';
import { AUTH_EMULATOR, FIREBASE_PROJECT } from '../../setup/constants.mjs';

const EMULATOR = `http://${AUTH_EMULATOR}`;

let counter = 0;
/** Email único por llamada: el emulador conserva las cuentas mientras vive. */
export const uniqueEmail = (prefix = 'persona') => `${prefix}-${Date.now()}-${counter++}@e2e.test`;

/**
 * Completa el popup de «Continuar con Google» contra el emulador de Firebase Auth: crea una cuenta nueva con el email
 * dado y la elige. `trigger` es el clic de la página que abre el popup. Devuelve el email de la cuenta.
 */
export async function signInWithGoogleViaEmulator(
  page: Page,
  trigger: () => Promise<void>,
  email: string = uniqueEmail(),
): Promise<string> {
  const popupPromise = page.waitForEvent('popup');
  await trigger();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.getByText('Add new account').click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#display-name-input').fill('Persona E2E');
  const closed = popup.waitForEvent('close');
  await popup.locator('#sign-in').click();
  await closed;
  return email;
}

/**
 * Igual que `signInWithGoogleViaEmulator` pero ELIGE una cuenta que ya existe en el emulador (segundo dispositivo de la
 * misma persona).
 */
export async function signInExistingViaEmulator(page: Page, trigger: () => Promise<void>, email: string): Promise<void> {
  const popupPromise = page.waitForEvent('popup');
  await trigger();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  const closed = popup.waitForEvent('close');
  await popup.getByText(email).click();
  await closed;
}

/**
 * ID token real del emulador para una cuenta que ya existe (inicia sesión con Google "por detrás"). Sirve para llamar al
 * back directamente con la identidad de esa persona, como lo haría un atacante con su propia sesión.
 */
export async function emulatorIdToken(email: string): Promise<string> {
  const res = await fetch(`${EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=e2e-api-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requestUri: 'http://localhost',
      returnSecureToken: true,
      postBody: `id_token=${encodeURIComponent(JSON.stringify({ sub: email, email, email_verified: true }))}&providerId=google.com`,
    }),
  });
  const body = (await res.json()) as { idToken?: string };
  expect(body.idToken, 'el emulador debe devolver un idToken').toBeTruthy();
  return body.idToken!;
}

/** Borra todas las cuentas del emulador (aislamiento entre tests). */
export async function clearEmulatorAccounts(): Promise<void> {
  const res = await fetch(`${EMULATOR}/emulator/v1/projects/${FIREBASE_PROJECT}/accounts`, { method: 'DELETE' });
  expect(res.ok).toBe(true);
}
