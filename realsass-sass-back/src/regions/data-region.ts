/**
 * data-region.ts — dominio puro (ADR-031)
 * Sin imports de NestJS ni Prisma.
 *
 * Región de datos = región lógica donde viven los datos de una organización:
 *   'ar' = Argentina · 'us' = Estados Unidos.
 * No es countryCode (qué ley aplica) ni Market (a qué países vende). El id 'ar'/'us' nombra una región,
 * no un país: una organización de Colombia (CO) cae en 'us'.
 *
 * OJO: hoy no hay infraestructura propia en Argentina. Ambas regiones se sirven desde la misma
 * infraestructura (EE.UU.) hasta que exista un despliegue en el país. 'ar' NO es una promesa de
 * residencia física en Argentina; ver ADR-031.
 *
 * Cuando haya otra región, solo cambia este archivo: nadie más lee el país para decidirlo.
 */

export const DATA_REGIONS = ['ar', 'us'] as const;
export type DataRegion = (typeof DATA_REGIONS)[number];

export const DEFAULT_DATA_REGION: DataRegion = 'us';

/** Países con región propia. El resto va a la región por defecto. */
const REGION_BY_COUNTRY: Readonly<Record<string, DataRegion>> = {
  AR: 'ar',
  US: 'us',
};

const ISO_ALPHA2 = /^[A-Z]{2}$/;

/**
 * Región de datos que le corresponde a un país.
 * Nunca falla: un país inválido o desconocido cae en la región por defecto (mismo criterio que resolveMarket, ADR-014).
 */
export function regionDe(countryCode: string | null | undefined): DataRegion {
  const code = (countryCode ?? '').trim().toUpperCase();
  if (!ISO_ALPHA2.test(code)) return DEFAULT_DATA_REGION;
  return REGION_BY_COUNTRY[code] ?? DEFAULT_DATA_REGION;
}

/** Valida un valor leído de la base: dato corrupto → región por defecto, nunca un 500. */
export function toDataRegion(value: string | null | undefined): DataRegion {
  return (DATA_REGIONS as readonly string[]).includes(value ?? '')
    ? (value as DataRegion)
    : DEFAULT_DATA_REGION;
}
