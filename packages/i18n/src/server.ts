/**
 * server.ts — idioma de la petición actual (Server Components / layouts). Solo servidor: usa next/headers.
 * Importar como `@real/i18n/server`.
 */
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, type Locale } from './config';
import { negotiateLocale } from './negotiate';

export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return negotiateLocale({
    cookieLocale:   cookieStore.get(LOCALE_COOKIE)?.value ?? null,
    acceptLanguage: headerStore.get('accept-language'),
  }).locale;
}
