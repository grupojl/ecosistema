/**
 * lib/checkout/resolve-checkout-locale.ts — PURO, sin deps de React/Zustand.
 *
 * Decide qué locale mandar al backend en checkout(), para que
 * notificaciones-backend pueda generar el invoice/email en el idioma
 * correcto (ADR-016). Separado en función pura para poder testearlo sin
 * jsdom — el store de Zustand que lo usa es solo el "cómo se guarda",
 * esto es el "qué se decide", que es lo que vale la pena testear.
 *
 * Prioridad: explícito (si el caller ya sabe el locale) > recordado
 * (última tienda /[locale]/ que el visitante navegó) > undefined (el
 * backend decide su propio default — nunca inventamos un locale acá).
 */
import { isLocale, type Locale } from '@/lib/i18n'

export function resolveCheckoutLocale(
  explicit:   string | null | undefined,
  remembered: string | null | undefined,
): Locale | undefined {
  if (isLocale(explicit)) return explicit
  if (isLocale(remembered)) return remembered
  return undefined
}
