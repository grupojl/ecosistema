/** Espera antes del próximo intento: 2^intentos segundos (2 s, 4 s, 8 s…), con tope de 5 minutos. */
export const MAX_ATTEMPTS = 10;
const MAX_DELAY_MS = 5 * 60 * 1_000;

export function nextDelayMs(attempts: number): number {
  const n = Math.max(1, Math.floor(attempts));
  return Math.min(2 ** n * 1_000, MAX_DELAY_MS);
}
