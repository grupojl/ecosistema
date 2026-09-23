/**
 * lib/i18n/negotiate.ts — negociación de idioma. PURO: sin Next, sin fetch.
 * Corre en el Edge (middleware) y se testea sin mocks.
 *
 * Prioridad (patrón Airbnb / Booking / Shopify):
 *   1. Cookie de elección explícita  → el usuario SIEMPRE gana.
 *   2. Accept-Language               → mejor señal de IDIOMA (un brasileño en
 *                                      Argentina tiene el navegador en pt).
 *   3. País del visitante            → solo si no hay Accept-Language y NO es bot.
 *   4. DEFAULT_LOCALE.
 *
 * El país es una señal débil de idioma: nunca pisa a Accept-Language.
 */
import { DEFAULT_LOCALE, isLocale, localeFromCountry, type Locale } from '@/lib/i18n/config';

export type LocaleSource = 'cookie' | 'accept-language' | 'country' | 'default';

export interface LocaleSignals {
  cookieLocale?:   string | null;
  acceptLanguage?: string | null;
  countryCode?:    string | null;
  userAgent?:      string | null;
}

export interface NegotiatedLocale {
  locale: Locale;
  source: LocaleSource;
}

interface WeightedTag {
  tag: string;
  q:   number;
}

const MAX_ACCEPT_LANGUAGE_LENGTH = 512; // defensa ante headers abusivos

export function parseAcceptLanguage(header: string | null | undefined): WeightedTag[] {
  if (!header) return [];

  return header
    .slice(0, MAX_ACCEPT_LANGUAGE_LENGTH)
    .split(',')
    .map((part, index): WeightedTag & { index: number } => {
      const [rawTag = '', ...params] = part.trim().split(';');
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return { tag: rawTag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((t) => t.tag.length > 0 && t.tag !== '*' && t.q > 0)
    // Orden estable: mayor q primero; empate → orden original del header.
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map(({ tag, q }) => ({ tag, q }));
}

/** Match por subtag primario: "pt-BR" → pt, "en-GB" → en. */
export function matchLocale(tags: readonly WeightedTag[]): Locale | null {
  for (const { tag } of tags) {
    const primary = tag.split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return null;
}

const CRAWLER_PATTERN =
  /bot|crawler|spider|crawling|googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|linkedinbot|twitterbot|applebot/i;

/**
 * Los crawlers salen mayormente de IPs de EE.UU. y sin Accept-Language:
 * usar su país los mandaría siempre a /en. Para ellos se ignora la señal país.
 */
export function isLikelyCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && CRAWLER_PATTERN.test(userAgent);
}

export function negotiateLocale(signals: LocaleSignals): NegotiatedLocale {
  if (isLocale(signals.cookieLocale)) {
    return { locale: signals.cookieLocale, source: 'cookie' };
  }

  const fromHeader = matchLocale(parseAcceptLanguage(signals.acceptLanguage));
  if (fromHeader) return { locale: fromHeader, source: 'accept-language' };

  if (!isLikelyCrawler(signals.userAgent)) {
    const fromCountry = localeFromCountry(signals.countryCode);
    if (fromCountry) return { locale: fromCountry, source: 'country' };
  }

  return { locale: DEFAULT_LOCALE, source: 'default' };
}
