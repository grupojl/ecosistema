/** format.ts — interpolación, plurales e Intl. Puro. */
import type { Locale } from './config';

export interface PluralForms { one: string; other: string }

/** Interpolación "{name}". Placeholder sin valor se deja intacto (visible en QA). */
export function t(template: string, vars: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Plural con Intl.PluralRules (reglas CLDR reales, no `n === 1`). */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const category = new Intl.PluralRules(locale).select(count);
  return t(category === 'one' ? forms.one : forms.other, { count });
}

/** BCP-47 para Intl: idioma de la interfaz + región de la organización (es + AR → es-AR). */
export function intlLocale(locale: Locale, regionCountryCode?: string | null): string {
  const region = regionCountryCode?.trim().toUpperCase();
  if (!region || !/^[A-Z]{2}$/.test(region)) return locale;
  try {
    return Intl.getCanonicalLocales(`${locale}-${region}`)[0] ?? locale;
  } catch {
    return locale;
  }
}
