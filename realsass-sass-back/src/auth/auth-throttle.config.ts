/**
 * auth-throttle.config.ts — realsass-sass-back
 *
 * Configuración de rate limiting estricto para endpoints de autenticación.
 *
 * POST /auth/session recibe 10 req/min por IP — más restrictivo que el
 * ThrottlerGuard global (30 req/min). Previene ataques de fuerza bruta
 * de tokens Firebase y abuso del endpoint de creación de sesiones.
 *
 * Cómo aplicar en un controller:
 *   @Throttle({ auth: { limit: 10, ttl: 60_000 } })
 *   @Post('session')
 *
 * El named throttler 'auth' debe estar registrado en ThrottlerModule.forRoot()
 * en app.module.ts — ver comentario ahí.
 *
 * E7-06 — Fase 3 Hardening
 */

export const AUTH_THROTTLE_CONFIG = {
  name:  'auth',
  ttl:   60_000, // 1 minuto en ms
  limit: 10,     // 10 requests por IP por minuto
} as const;

/**
 * Configuración completa para ThrottlerModule.forRoot() en app.module.ts.
 * Reemplazar el array existente con este para habilitar el named throttler.
 *
 * ThrottlerModule.forRoot([
 *   { name: 'default', ttl: 60_000, limit: 30 },  // global: 30/min
 *   { name: 'auth',    ttl: 60_000, limit: 10 },  // auth:   10/min ← nuevo
 * ])
 */
export const THROTTLER_CONFIG = [
  { name: 'default', ttl: 60_000, limit: 30 },
  { name: 'auth',    ttl: 60_000, limit: 10 },
] as const;
