/**
 * lib/i18n — API pública.
 *
 * Diccionarios tipados e importados estáticamente. 5 idiomas activos hoy
 * (es/pt/en/fr/de) — el mapeo de países cubre el mundo entero (countries.ts);
 * activar un idioma nuevo es agregar su diccionario acá + a LOCALES.
 */
import { de } from '@/lib/i18n/dictionaries/de';
import { en } from '@/lib/i18n/dictionaries/en';
import { es } from '@/lib/i18n/dictionaries/es';
import { fr } from '@/lib/i18n/dictionaries/fr';
import { pt } from '@/lib/i18n/dictionaries/pt';
import type { Dictionary, PluralForms } from '@/lib/i18n/dictionaries/types';
import type { Locale } from '@/lib/i18n/config';

export * from '@/lib/i18n/config';
export * from '@/lib/i18n/countries';
export type { Dictionary, PluralForms };

const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = { es, pt, en, fr, de };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Interpolación "{name}". Placeholder sin valor se deja intacto (visible en QA). */
export function t(template: string, vars: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** Plural con Intl.PluralRules (reglas CLDR reales, no `n === 1`). */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const category = new Intl.PluralRules(locale).select(count);
  return t(category === 'one' ? forms.one : forms.other, { count });
}
