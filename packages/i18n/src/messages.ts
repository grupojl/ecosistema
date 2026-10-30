/**
 * messages.ts — diccionario común por idioma y unión con el de cada front.
 *
 * Cada front define su propio contrato (`interface FrontDictionary extends CommonDictionary { … }`) y un diccionario por
 * idioma con `satisfies`; acá solo viven los textos que comparten todos los paneles.
 */
import type { Locale } from './config';
import { de } from './dictionaries/de';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { fr } from './dictionaries/fr';
import { pt } from './dictionaries/pt';
import type { CommonDictionary } from './dictionaries/types';

export type { CommonDictionary };

const COMMON: Readonly<Record<Locale, CommonDictionary>> = { es, pt, en, fr, de };

export function getCommonDictionary(locale: Locale): CommonDictionary {
  return COMMON[locale];
}

/**
 * Une el diccionario común con el del front, sección por sección (las del front pueden ampliar `common`/`auth`
 * sin pisar las compartidas). Un solo nivel de profundidad: los diccionarios son `{ sección: { key: string } }`.
 */
export function mergeDictionaries<F extends object>(common: CommonDictionary, own: F): CommonDictionary & F {
  const merged: Record<string, unknown> = { ...common };
  for (const [section, value] of Object.entries(own)) {
    const base = merged[section];
    merged[section] =
      base && typeof base === 'object' && value && typeof value === 'object'
        ? { ...(base as object), ...(value as object) }
        : value;
  }
  return merged as CommonDictionary & F;
}
