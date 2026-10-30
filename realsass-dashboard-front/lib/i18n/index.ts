/**
 * lib/i18n — diccionario del dashboard = común de @real/i18n + textos propios.
 * Hoy solo usa el común (acceso, acciones). Al traducir una pantalla nueva: sumar su sección acá con un
 * diccionario por idioma (`satisfies`) y unirla con mergeDictionaries, igual que el storefront.
 */
import { getCommonDictionary, type CommonDictionary, type Locale } from '@real/i18n';

export type Dictionary = CommonDictionary;

export function getDictionary(locale: Locale): Dictionary {
  return getCommonDictionary(locale);
}
