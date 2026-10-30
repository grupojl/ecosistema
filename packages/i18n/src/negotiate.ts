/**
 * negotiate.ts — negociación de idioma de los paneles. PURO: sin Next, sin fetch.
 *
 * Prioridad (misma que el storefront, sin la señal de país: en un panel autenticado no aporta):
 *   1. Cookie de elección explícita → el usuario SIEMPRE gana.
 *   2. Accept-Language del navegador.
 *   3. DEFAULT_LOCALE.
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from './config';

export type LocaleSource = 'cookie' | 'accept-language' | 'default';

export interface LocaleSignals {
  cookieLocale?:   string | null;
  acceptLanguage?: string | null;
}

export interface NegotiatedLocale {
  locale: Locale;
  source: LocaleSource;
}

const MAX_ACCEPT_LANGUAGE_LENGTH = 512; // defensa ante headers abusivos

interface WeightedTag { tag: string; q: number }

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
    .sort((a, b) => b.q - a.q || a.index - b.index) // mayor q primero; empate → orden original
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

export function negotiateLocale(signals: LocaleSignals): NegotiatedLocale {
  if (isLocale(signals.cookieLocale)) return { locale: signals.cookieLocale, source: 'cookie' };

  const fromHeader = matchLocale(parseAcceptLanguage(signals.acceptLanguage));
  if (fromHeader) return { locale: fromHeader, source: 'accept-language' };

  return { locale: DEFAULT_LOCALE, source: 'default' };
}
