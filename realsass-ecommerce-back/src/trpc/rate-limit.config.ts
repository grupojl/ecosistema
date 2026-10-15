import type { RateLimitOptions } from '@real/auth-server';

/**
 * Política de rate limit de /trpc (ADR-023). Vive en su propio módulo para que TrpcModule y los tests
 * usen exactamente la misma configuración.
 *
 * ThrottlerGuard solo cubre controllers y /trpc es middleware de Express, así que se limita acá.
 */

/** Por IP, ANTES de autenticar. identify crea filas y checkout reserva stock: son lo más abusable. */
export const IP_RATE_LIMIT: RateLimitOptions = {
  defaultRule: { limit: 300, windowMs: 60_000, by: 'ip' },
  rules: [
    { procedures: ['customer.identify'], limit: 10, windowMs: 60_000, by: 'ip' },
    { procedures: ['customer.checkout'], limit: 10, windowMs: 60_000, by: 'ip' },
  ],
};

/** Por usuario del dashboard, DESPUÉS de autenticar. */
export const USER_RATE_LIMIT: RateLimitOptions = {
  defaultRule: { limit: 300, windowMs: 60_000, by: 'user' },
};
