import { MemoryRateLimitStore, type RateLimitStore } from './rate-limit';

/**
 * Lo mínimo que se le pide a Redis: un contador atómico con vencimiento. Cada back lo implementa con su
 * propio RedisService (null = Redis deshabilitado). Se define como interfaz para que auth-server no dependa
 * de ioredis.
 */
export interface RedisCounter {
  /** Suma 1 a `key`; si es el primer golpe de la ventana le pone `ttlMs`. Devuelve el total, o null si no hay Redis. */
  incrWithTtl(key: string, ttlMs: number): Promise<number | null>;
}

/**
 * Rate limit compartido entre réplicas (ADR-023). Con el store en memoria cada instancia cuenta por su cuenta
 * y con N réplicas el límite efectivo se multiplica por N; con Redis el contador es uno solo.
 *
 * Si Redis está deshabilitado o falla, cae a memoria: el límite se degrada a "por instancia" pero NUNCA se
 * cae el servicio ni se bloquea a todo el mundo por una falla del rate limit.
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redis: RedisCounter,
    private readonly fallback: RateLimitStore = new MemoryRateLimitStore(),
  ) {}

  async hit(key: string, windowMs: number): Promise<number> {
    try {
      const count = await this.redis.incrWithTtl(key, windowMs);
      if (count !== null) return count;
    } catch {
      // Redis caído: se usa el contador local.
    }
    return this.fallback.hit(key, windowMs);
  }
}
