/**
 * tiers.ts — tramo de precio según la población del municipio (welver-domain.md §5).
 *
 * Dominio puro: sin Nest ni Prisma. El tramo SE DERIVA de la población; nunca se guarda como dato propio del municipio
 * (la suscripción guarda el tramo contratado, que puede quedar atrás si la población cambia).
 *
 *   1  hasta 20.000 habitantes
 *   2  de 20.001 a 100.000
 *   3  de 100.001 a 500.000
 *   4  más de 500.000
 */
export type Tier = 1 | 2 | 3 | 4;

export const TIER_UPPER_BOUNDS = [20_000, 100_000, 500_000] as const;

export const MAX_POPULATION = 50_000_000;

export class InvalidPopulationError extends Error {
  constructor(value: unknown) {
    super(
      `Población inválida: ${String(value)}. Debe ser un entero entre 1 y ${MAX_POPULATION}.`,
    );
    this.name = 'InvalidPopulationError';
  }
}

export function isValidPopulation(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_POPULATION
  );
}

export function tierForPopulation(population: number): Tier {
  if (!isValidPopulation(population))
    throw new InvalidPopulationError(population);
  if (population <= TIER_UPPER_BOUNDS[0]) return 1;
  if (population <= TIER_UPPER_BOUNDS[1]) return 2;
  if (population <= TIER_UPPER_BOUNDS[2]) return 3;
  return 4;
}

/** Estrecha un número guardado (Int de la base) a Tier sin `as`. */
export function toTier(value: number): Tier {
  switch (value) {
    case 1:
    case 2:
    case 3:
    case 4:
      return value;
    default:
      throw new RangeError(`Tramo inválido: ${value}`);
  }
}
