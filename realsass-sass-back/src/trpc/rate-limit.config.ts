import type { RateLimitOptions } from '@real/auth-server';

/**
 * Política de rate limit de /trpc (ADR-023). ThrottlerGuard solo cubre controllers y /trpc es
 * middleware de Express, así que se limita acá.
 */

/** Por IP, ANTES de autenticar: frena inundaciones sin gastar CPU en verificar tokens de Firebase. */
export const IP_RATE_LIMIT: RateLimitOptions = {
  defaultRule: { limit: 600, windowMs: 60_000, by: 'ip' },
  rules: [{ procedures: ['auth.*'], limit: 60, windowMs: 60_000, by: 'ip' }],
};

/** Por usuario, DESPUÉS de autenticar. */
export const USER_RATE_LIMIT: RateLimitOptions = {
  defaultRule: { limit: 300, windowMs: 60_000, by: 'user' },
};
