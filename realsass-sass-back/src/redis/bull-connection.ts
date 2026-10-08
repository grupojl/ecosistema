// src/redis/bull-connection.ts
// Conexión de BullMQ (cola de webhooks) a partir de REDIS_URL.
//
// BullMQ no acepta una URL: se descompone en host/puerto/credenciales. Sin esta conexión el worker
// de webhooks lanza "Worker requires a connection" al iniciar y el servidor no arranca.
import type { ConnectionOptions } from 'bullmq';

export function bullConnection(): ConnectionOptions {
  const url = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    // La red privada de Railway (*.railway.internal) resuelve por IPv6: dual stack.
    family: 0,
    // Requerido por BullMQ para los workers (conexiones bloqueantes).
    maxRetriesPerRequest: null,
  };
}
