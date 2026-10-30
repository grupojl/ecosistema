/**
 * lib/market/visitor-country-header.ts — PURO.
 *
 * El storefront es el DETECTOR del país (ADR-014): cuando el visitante tiene un mercado elegido lo manda en
 * `x-visitor-country` y el back resuelve el Market de la orden. Sin mercado elegido no se manda nada: el back usa
 * CF-IPCountry (si hay Cloudflare) o el Market default. Solo se acepta un código ISO de 2 letras.
 */
export function visitorCountryHeader(country: string | null | undefined): Record<string, string> {
  const code = country?.trim().toUpperCase()
  return code && /^[A-Z]{2}$/.test(code) ? { 'x-visitor-country': code } : {}
}
