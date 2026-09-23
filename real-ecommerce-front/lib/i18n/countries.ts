/**
 * lib/i18n/countries.ts — mapa MUNDIAL país → idioma dominante. PURO, sin deps.
 *
 * Deliberadamente separado de config.ts: este archivo es un dato factual
 * (qué idioma se habla en cada país), no una decisión de producto (qué
 * idiomas activamos con diccionario). Esa separación es la que permite
 * "agregar todo el mapeo ahora, activar diccionarios cuando haga falta"
 * sin tocar esta tabla de nuevo — activar un idioma nuevo es sumar su
 * diccionario a LOCALES en config.ts, no editar este archivo.
 *
 * Código de idioma: ISO 639-1. Puede no estar en LOCALES (config.ts) —
 * eso es intencional y esperado: significa "sabemos qué idioma es, todavía
 * no lo activamos". config.ts decide qué hacer con ese caso (fallback +
 * log, ver primaryLocaleForCountry).
 *
 * REGLA DURA heredada de ADR-016 (norte IKEA): un país con más de un idioma
 * oficial/dominante de peso comparable NO se mapea acá. Se listan en
 * MULTILINGUAL_COUNTRIES, documentados, para que Accept-Language decida —
 * nunca la tabla país→idioma.
 *
 * Cobertura: estados soberanos con relevancia real de e-commerce
 * transfronterizo. No se listan microterritorios sin mercado propio.
 * Dato de idioma oficial/dominante mayoritario, no un censo lingüístico.
 */

export const WORLD_LANGUAGE_BY_COUNTRY: Readonly<Record<string, string>> = {
  // ── Español ──────────────────────────────────────────────────────────────
  AR: 'es', BO: 'es', CL: 'es', CO: 'es', CR: 'es', CU: 'es', DO: 'es', EC: 'es',
  ES: 'es', GT: 'es', HN: 'es', MX: 'es', NI: 'es', PA: 'es', PE: 'es', PY: 'es',
  SV: 'es', UY: 'es', VE: 'es', GQ: 'es',

  // ── Portugués ────────────────────────────────────────────────────────────
  BR: 'pt', PT: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt', TL: 'pt',

  // ── Inglés (única lengua oficial/dominante de peso) ─────────────────────
  US: 'en', GB: 'en', AU: 'en', NZ: 'en', IE: 'en', JM: 'en', TT: 'en', BZ: 'en',
  BS: 'en', BB: 'en', GY: 'en', ZW: 'en', ZM: 'en', GH: 'en', UG: 'en', MW: 'en',
  BW: 'en', NA: 'en', LR: 'en', SL: 'en', GM: 'en', SS: 'en', FJ: 'en', MU: 'en',
  SC: 'en', TO: 'en', WS: 'en', VU: 'en', SB: 'en', PG: 'en', KI: 'en', FM: 'en',
  MH: 'en', PW: 'en', NR: 'en', TV: 'en', AG: 'en', DM: 'en', GD: 'en', KN: 'en',
  LC: 'en', VC: 'en',

  // ── Francés ──────────────────────────────────────────────────────────────
  FR: 'fr', SN: 'fr', ML: 'fr', NE: 'fr', TD: 'fr', GN: 'fr', BJ: 'fr', TG: 'fr',
  CI: 'fr', GA: 'fr', CG: 'fr', CD: 'fr', MC: 'fr', MG: 'fr', DJ: 'fr', KM: 'fr',
  HT: 'fr', LU: 'fr',

  // ── Alemán ───────────────────────────────────────────────────────────────
  DE: 'de', AT: 'de', LI: 'de',

  // ── Otros idiomas reconocidos (dato correcto; sin diccionario activo hoy) ──
  IT: 'it', SM: 'it', VA: 'it',
  NL: 'nl', SR: 'nl',
  RU: 'ru', BY: 'ru',
  JP: 'ja',
  KR: 'ko', KP: 'ko',
  CN: 'zh', TW: 'zh',
  SA: 'ar', AE: 'ar', EG: 'ar', IQ: 'ar', JO: 'ar', KW: 'ar', QA: 'ar', OM: 'ar',
  BH: 'ar', LB: 'ar', LY: 'ar', TN: 'ar', DZ: 'ar', MA: 'ar', SD: 'ar', YE: 'ar',
  SY: 'ar', MR: 'ar',
  TR: 'tr',
  IL: 'he',
  IR: 'fa', AF: 'fa',
  TH: 'th',
  VN: 'vi',
  ID: 'id',
  MY: 'ms', BN: 'ms',
  PH: 'tl',
  MM: 'my',
  KH: 'km',
  LA: 'lo',
  MN: 'mn',
  BD: 'bn',
  LK: 'si',
  NP: 'ne',
  BT: 'dz',
  MV: 'dv',
  PL: 'pl',
  UA: 'uk',
  RO: 'ro', MD: 'ro',
  HU: 'hu',
  CZ: 'cs',
  SK: 'sk',
  BG: 'bg',
  RS: 'sr', ME: 'sr',
  HR: 'hr',
  SI: 'sl',
  BA: 'bs',
  MK: 'mk',
  AL: 'sq', XK: 'sq', // XK (Kosovo) es código de facto (EU, SWIFT), no asignado formalmente por ISO 3166-1
  GR: 'el', CY: 'el',
  SE: 'sv',
  NO: 'no',
  DK: 'da',
  FI: 'fi',
  IS: 'is',
  EE: 'et',
  LV: 'lv',
  LT: 'lt',
  GE: 'ka',
  AM: 'hy',
  AZ: 'az',
  KZ: 'kk',
  UZ: 'uz',
  TM: 'tk',
  TJ: 'tg',
  KG: 'ky',
  ET: 'am',
  SO: 'so',
  RW: 'rw',
  BI: 'rn',
  TZ: 'sw', KE: 'sw',
} as const;

/**
 * Países con más de un idioma dominante de peso comparable: NO se mapean a
 * propósito (norte IKEA, ADR-016 D2). Accept-Language decide, nunca esta
 * tabla. Documentado para que sumarlos "por completitud" sea una decisión
 * explícita, no un olvido.
 */
export const MULTILINGUAL_COUNTRIES: readonly string[] = [
  'CA', // inglés / francés
  'CH', // alemán / francés / italiano / romanche
  'BE', // neerlandés / francés / alemán
  'IN', // hindi / inglés + 20+ idiomas regionales oficiales
  'PK', // urdu / inglés / punjabi
  'NG', // inglés + cientos de lenguas locales, sin dominante único
  'ZA', // 11 idiomas oficiales
  'SG', // inglés / mandarín / malayo / tamil
] as const;

/**
 * Idioma dominante de un país, SIN filtrar por si tenemos diccionario o no.
 * Uso interno de config.ts — el filtro contra LOCALES vive ahí, no acá.
 */
export function worldLanguageForCountry(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null;
  const normalized = countryCode.trim().toUpperCase();
  if (MULTILINGUAL_COUNTRIES.includes(normalized)) return null;
  return WORLD_LANGUAGE_BY_COUNTRY[normalized] ?? null;
}
