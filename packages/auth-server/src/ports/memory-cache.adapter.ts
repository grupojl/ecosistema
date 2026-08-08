import { Injectable } from '@nestjs/common';
import type { CachePort } from './cache.port';

interface Entry {
  value: unknown;
  exp:   number;
}

/**
 * MemoryCacheAdapter — implementacion en memoria del CachePort.
 * Usar en desarrollo y produccion sin Redis.
 * Limitacion: no se comparte entre instancias del proceso (escala vertical).
 */
@Injectable()
export class MemoryCacheAdapter implements CachePort {
  private readonly store = new Map<string, Entry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, exp: Date.now() + ttlSeconds * 1_000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}
