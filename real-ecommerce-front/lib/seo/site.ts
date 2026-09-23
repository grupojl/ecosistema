/**
 * lib/seo/site.ts — URLs absolutas, canonical y hreflang.
 *
 * SITE_URL (runtime, NO NEXT_PUBLIC): URL pública del storefront, sin barra final.
 * Fail-soft: si falta, se omiten canonical/hreflang (y se loguea) en vez de
 * tirar 500 en todas las tiendas. Un canonical a localhost sería PEOR que
 * no tener canonical.
 */
import type { Metadata } from 'next';
import type { Locale } from '@/lib/i18n';

let cachedSiteUrl: URL | null | undefined;

export function getSiteUrl(): URL | null {
  if (cachedSiteUrl !== undefined) return cachedSiteUrl;

  const raw = process.env['SITE_URL']?.trim();
  if (!raw) {
    console.error('[seo] SITE_URL no configurado — canonical/hreflang/sitemap deshabilitados');
    cachedSiteUrl = null;
    return null;
  }
  try {
    const url = new URL(raw.replace(/\/+$/, ''));
    cachedSiteUrl = url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    console.error(`[seo] SITE_URL inválido: "${raw}"`);
    cachedSiteUrl = null;
  }
  return cachedSiteUrl;
}

/** Solo para tests. */
export function __resetSiteUrlCacheForTests(): void {
  cachedSiteUrl = undefined;
}

/** "/tienda/x" + es → "/es/tienda/x". El path SIEMPRE empieza con "/tienda". */
export function localizedPath(locale: Locale, path: string): string {
  return `/${locale}${path}`;
}

export function absoluteUrl(site: URL, path: string): string {
  return new URL(path, `${site.origin}/`).toString();
}

export interface AlternatesInput {
  /** Path sin idioma, ej "/tienda/mi-marca/productos". Puede incluir "?page=2". */
  path:             string;
  currentLocale:    Locale;
  indexableLocales: readonly Locale[];
}

/**
 * - canonical: SIEMPRE self-referencial (nunca cruzar idiomas en canonical).
 * - hreflang: solo idiomas indexables + x-default → URL sin idioma, que
 *   negocia y redirige (patrón "locale selector" que Google documenta).
 */
export function buildAlternates(input: AlternatesInput): Metadata['alternates'] {
  const site = getSiteUrl();
  if (!site) return undefined;

  const languages: Record<string, string> = {};
  for (const locale of input.indexableLocales) {
    languages[locale] = absoluteUrl(site, localizedPath(locale, input.path));
  }
  languages['x-default'] = absoluteUrl(site, input.path);

  return {
    canonical: absoluteUrl(site, localizedPath(input.currentLocale, input.path)),
    languages,
  };
}

/** Idiomas sin contenido traducido: navegables por humanos, `noindex` para Google. */
export function robotsFor(currentLocale: Locale, indexableLocales: readonly Locale[]): Metadata['robots'] {
  return indexableLocales.includes(currentLocale)
    ? { index: true, follow: true }
    : { index: false, follow: true };
}
