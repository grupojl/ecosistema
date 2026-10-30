/**
 * config.ts — idiomas ACTIVOS de los paneles (sass-front, dashboard-front, design, docs).
 *
 * Mismo conjunto y misma cookie que el storefront (real-ecommerce-front/lib/i18n/config.ts), así la elección
 * del usuario lo sigue entre fronts del mismo dominio. A diferencia del storefront, el idioma NO va en la URL:
 * los paneles no se indexan y sus URLs limpias son contrato (ADR-022). Se decide por cookie.
 *
 * Activar un idioma nuevo = agregarlo acá + su diccionario común (dictionaries/) + el de cada front.
 */
export const LOCALES = ['es', 'pt', 'en', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';

/** Nombre de cada idioma en su propio idioma: no se traduce (un usuario perdido debe poder reconocer el suyo). */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  es: 'Español',
  pt: 'Português',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
};

/** Idiomas de derecha a izquierda. Vacío hoy; `<html dir>` ya lo lee de acá (ver localeDir). */
export const RTL_LOCALES: readonly Locale[] = [];

export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function localeDir(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}
