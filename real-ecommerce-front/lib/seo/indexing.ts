/**
 * lib/seo/indexing.ts — qué idiomas de una tienda se INDEXAN.
 *
 * Decisión clave de ADR-016: traducir solo la UI (botones, menús) mientras
 * nombres/descripciones de producto siguen en el idioma del dueño produce
 * páginas casi duplicadas entre /es, /pt y /en. Google las trata como
 * duplicados, ignora el hreflang y elige un canonical por su cuenta.
 *
 * Por eso: el HUMANO ve la UI en su idioma (automático), pero Google solo
 * indexa el idioma en el que el contenido fue escrito. Cuando exista
 * ProductTranslation (Fase 2, patrón Shopify Translate & Adapt), esta
 * función devuelve además los idiomas con cobertura de traducción.
 */
import { primaryLocaleForCountry, type Locale } from '@/lib/i18n';

export interface IndexableStore {
  countryCode: string;
}

export function indexableLocalesForStore(store: IndexableStore): readonly Locale[] {
  return [primaryLocaleForCountry(store.countryCode)];
}
