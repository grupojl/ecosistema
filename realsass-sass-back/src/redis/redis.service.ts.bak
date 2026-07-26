// src/redis/redis.service.ts
// REDIS_ENABLED=false → no-op (útil en dev sin Redis)
// REDIS_ENABLED=true  → conexión real via REDIS_URL
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';

const REDIS_OPTIONS: RedisOptions = {
  retryStrategy:    (r) => (r > 10 ? null : Math.min(r * 200, 5_000)),
  reconnectOnError: (e) => e.message.includes('ECONNRESET') ? 2 : false,
  lazyConnect:         true,
  maxRetriesPerRequest: 3,
  connectTimeout:      10_000,
  enableOfflineQueue:  true,
};

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  private get enabled(): boolean {
    return process.env['REDIS_ENABLED'] === 'true';
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('Redis deshabilitado (REDIS_ENABLED != true) — modo no-op');
      return;
    }
    const url = process.env['REDIS_URL'];
    if (!url) {
      this.logger.warn('REDIS_URL no configurada — Redis en modo no-op');
      return;
    }
    this.client = new Redis(url, REDIS_OPTIONS);
    this.client.on('error',        (e: Error)  => this.logger.warn(`Redis error: ${e.message}`));
    this.client.on('reconnecting', (d: number) => this.logger.log(`Redis reconectando en ${d}ms...`));
    this.client.on('connect',      ()          => this.logger.log('Redis conectado ✓'));
    try { await this.client.connect(); }
    catch (e) { this.logger.error(`Redis no disponible: ${e} — modo no-op`); this.client = null; }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client ? this.client.get(key) : null;
  }
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    ttlSeconds ? await this.client.set(key, value, 'EX', ttlSeconds)
               : await this.client.set(key, value);
  }
  async del(key: string): Promise<void> {
    if (this.client) await this.client.del(key);
  }
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }
  get isConnected(): boolean { return this.client?.status === 'ready'; }
}
