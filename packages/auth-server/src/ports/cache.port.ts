/**
 * CachePort — abstraccion de cache para TenantGuard.
 *
 * Implementaciones:
 *   MemoryCacheAdapter  — dev y produccion sin Redis (default)
 *   RedisCacheAdapter   — produccion con Redis (Sprint 2, opcional)
 *
 * Registrar en AppModule con:
 *   { provide: CACHE_PORT, useClass: MemoryCacheAdapter }
 */
export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export const CACHE_PORT = Symbol('CACHE_PORT');
