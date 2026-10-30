import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Compara dos secretos en tiempo constante. Se hashea cada uno con SHA-256 antes de comparar: `timingSafeEqual` exige
 * longitudes iguales, y devolver antes por diferencia de largo filtraría cuántos caracteres tiene la clave real.
 * Un secreto vacío o ausente nunca es igual a nada (ni a otro vacío).
 */
export function safeEqual(
  given: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (!given || !expected) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
