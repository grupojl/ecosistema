// Primitivas de seguridad de @real/auth-server (sin dependencia de Nest/Firebase: se pueden probar en aislado).
export { parseKeys, parseKeyEntries, firstKey, safeEqual, matchesAnyKey, identifyCaller } from './keys';
export type { KeyEntry } from './keys';
export { requireEnv, parseAllowedOrigins, trustProxyHops } from './require-env';
export { CircuitBreaker, CircuitOpenError } from '../http/circuit-breaker';
export { createRateLimitMiddleware, MemoryRateLimitStore } from '../http/rate-limit';
export { RedisRateLimitStore } from '../http/redis-rate-limit';
export type { RedisCounter } from '../http/redis-rate-limit';
export type { RateLimitStore, RateLimitRule, RateLimitOptions } from '../http/rate-limit';
