/**
 * lib/i18n — diccionario de sass-front = común de @real/i18n + textos propios (un archivo por idioma, `satisfies`).
 * Para traducir otra pantalla: sumar su sección a OwnDictionary y a cada idioma; el compilador marca los que falten.
 */
import { getCommonDictionary, mergeDictionaries, type CommonDictionary, type Locale } from '@real/i18n';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { pt } from './pt';
import type { OwnDictionary } from './types';

export type Dictionary = CommonDictionary & OwnDictionary;

const OWN: Readonly<Record<Locale, OwnDictionary>> = { es, pt, en, fr, de };

export function getDictionary(locale: Locale): Dictionary {
  return mergeDictionaries(getCommonDictionary(locale), OWN[locale]);
}
