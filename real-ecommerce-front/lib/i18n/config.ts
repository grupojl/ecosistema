/**
 * lib/i18n/config.ts — fuente única de verdad de idiomas ACTIVOS del storefront.
 *
 * ADR-016: la URL lleva IDIOMA (no país). País → Market (ADR-014) + formato
 * regional de precios. Idioma → contenido de la página y hreflang.
 *
 * Diseño en dos capas (ver countries.ts):
 *   - countries.ts   → qué idioma se habla en cada país del MUNDO (dato factual,
 *                       ~180 países, no cambia cuando activamos un idioma nuevo).
 *   - config.ts (acá) → qué idiomas tenemos ACTIVOS con diccionario (LOCALES).
 *                       Activar un idioma nuevo = agregar su diccionario acá.
 *                       Esa es la única fuente de deuda de deploy: el mapeo
 *                       de países ya está completo para el mundo entero.
 */
import { worldLanguageForCountry } from './countries';

export const LOCALES = ['es', 'pt', 'en', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';

/**
 * Idiomas que se leen de derecha a izquierda. Vacío hoy porque ningún
 * diccionario RTL (árabe, hebreo, persa, urdu) está activo todavía — pero
 * la arquitectura ya está lista: <html dir> en app/[locale]/layout.tsx lee
 * de acá. Activar árabe el día de mañana es: 1) escribir dictionaries/ar.ts,
 * 2) agregar 'ar' a LOCALES, 3) agregar 'ar' acá. Cero cambios de layout.
 */
export const RTL_LOCALES: readonly Locale[] = [] as const;

export function isRtlLocale(locale: Locale): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

/** Cookie de elección EXPLÍCITA del usuario. Solo la escribe el selector de idioma. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Idioma dominante de un país, filtrado contra los idiomas ACTIVOS (LOCALES).
 * Devuelve null si el país no tiene idioma dominante inequívoco (países
 * multilingües — ver countries.ts) O si su idioma dominante es real pero
 * todavía no tenemos diccionario para él (ej. Japón → 'ja', no está en
 * LOCALES → null acá, aunque countries.ts sí lo conoce).
 *
 * Usado por negotiate.ts en el hot path de cada request — sin logging: que
 * un visitante de Japón no tenga 'ja' activo es esperado y frecuente, no
 * un bug a reportar por request. Compará con primaryLocaleForCountry abajo.
 */
export function localeFromCountry(countryCode: string | null | undefined): Locale | null {
  const lang = worldLanguageForCountry(countryCode);
  return lang && isLocale(lang) ? lang : null;
}

/**
 * Idioma primario INDEXABLE de una tienda, según el país base de la
 * organización (usado por indexableLocalesForStore, no por request).
 *
 * A diferencia de localeFromCountry: acá SÍ es un problema real y accionable
 * si el país de una tienda no tiene idioma activo — significa que esa
 * tienda existe, tiene un país base conocido, pero el negocio la va a
 * indexar en el idioma equivocado (DEFAULT_LOCALE) hasta que activemos su
 * idioma. Por eso loguea: es la señal que dice "activá este idioma ya".
 * Nunca lanza — el contrato de ADR-014/016 es no bloquear nunca.
 */
export function primaryLocaleForCountry(countryCode: string | null | undefined): Locale {
  const active = localeFromCountry(countryCode);
  if (active) return active;

  const worldLang = worldLanguageForCountry(countryCode);
  if (worldLang && !isLocale(worldLang)) {
    // Idioma real y conocido, pero sin diccionario activo: esto es deuda
    // de producto visible, no un país desconocido ni multilingüe.
    console.warn(
      `[i18n] País "${countryCode}" tiene idioma dominante "${worldLang}" sin diccionario activo. ` +
      `La tienda se está indexando en "${DEFAULT_LOCALE}" (incorrecto) hasta activar "${worldLang}" en LOCALES.`,
    );
  }
  return DEFAULT_LOCALE;
}

/**
 * BCP-47 para Intl (precios, fechas): idioma de la URL + región de la tienda.
 * es + AR → es-AR ; pt + BR → pt-BR ; en + AR → en-AR (formato válido en Intl).
 */
export function intlLocale(locale: Locale, regionCountryCode: string | null | undefined): string {
  const region = regionCountryCode?.trim().toUpperCase();
  if (!region || !/^[A-Z]{2}$/.test(region)) return locale;
  try {
    return Intl.getCanonicalLocales(`${locale}-${region}`)[0] ?? locale;
  } catch {
    return locale;
  }
}

/** og:locale usa guion bajo: es_AR, pt_BR. */
export function openGraphLocale(locale: Locale, regionCountryCode: string | null | undefined): string {
  return intlLocale(locale, regionCountryCode).replace('-', '_');
}
