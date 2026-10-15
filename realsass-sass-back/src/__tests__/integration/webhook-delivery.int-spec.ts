/**
 * webhook-delivery.int-spec.ts — sass-back con Redis, Postgres y un receptor HTTP REALES.
 *
 * Entrega de webhooks de punta a punta: WebhookDeliveryService encola en una cola BullMQ real, un Worker real ejecuta
 * el WebhookDeliveryProcessor real (con RLS: la base se consulta con el rol eco_app) y un servidor HTTP local hace de
 * cliente receptor. Cubre firma, reintentos con backoff, agotamiento y aislamiento por organización.
 *
 * Único doble: el anti-SSRF (assertPublicHttpUrl), que rechaza 127.0.0.1 a propósito y tiene su propio spec.
 *
 * Requiere TEST_REDIS_URL y TEST_APP_DATABASE_URL (+ TEST_DATABASE_URL para limpiar). Se saltea con aviso si faltan;
 * en el CI son obligatorias.
 */
import { createHmac } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Queue, Worker } from 'bullmq';
import * as pg from 'pg';

const redisUrl = process.env['TEST_REDIS_URL'];
const appUrl = process.env['TEST_APP_DATABASE_URL'];
const adminUrl = process.env['TEST_DATABASE_URL'];
if (appUrl) process.env['DATABASE_URL'] = appUrl;
process.env['CONFIG_MASTER_KEY'] = 'a'.repeat(64);
process.env['WEBHOOK_MAX_RETRIES'] = '3';

jest.mock('@/common/security/assert-public-url', () => {
  class UnsafeUrlError extends Error {}
  return { assertPublicHttpUrl: jest.fn().mockResolvedValue(undefined), UnsafeUrlError };
});

import { PrismaService } from '@/prisma/prisma.service';
import { runAsSystem } from '@/prisma/tenant-context';
import { CryptoService } from '@/config-secrets/crypto.service';
import { bullConnection } from '@/redis/bull-connection';
import { PrismaWebhooksRepository } from '@/config-webhooks/repository/prisma-webhooks.repository';
import { WebhookDeliveryService } from '@/config-webhooks/webhook-delivery.service';
import { WebhookDeliveryProcessor } from '@/config-webhooks/webhook-delivery.processor';

const enabled = Boolean(redisUrl && appUrl && adminUrl);
if (!enabled) {
  // eslint-disable-next-line no-console
  console.warn('[webhook-delivery.int-spec] faltan TEST_REDIS_URL / TEST_APP_DATABASE_URL / TEST_DATABASE_URL: se saltea.');
}
const suite = enabled ? describe : describe.skip;

const SECRET = 'whsec_secreto-de-prueba';
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(100);
  }
  throw new Error(`waitFor: no se cumplió en ${timeoutMs} ms`);
}

interface Received { path: string; body: string; headers: http.IncomingHttpHeaders }

/** Receptor HTTP real. `respond(n, path)` decide el status según cuántas veces fue llamado ese path. */
function receiver(respond: (attempt: number, path: string) => number) {
  const received: Received[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const path = req.url ?? '/';
      received.push({ path, body: Buffer.concat(chunks).toString('utf8'), headers: req.headers });
      res.statusCode = respond(received.filter((r) => r.path === path).length, path);
      res.end();
    });
  });
  return {
    received,
    listen: () => new Promise<string>((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`))),
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }),
  };
}

suite('Entrega de webhooks con BullMQ + Redis + Postgres reales', () => {
  const prisma = new PrismaService();
  const admin = new pg.Pool({ connectionString: adminUrl });
  const crypto = new CryptoService();
  const prefix = `it-${process.pid}`;
  const queue = new Queue('webhook-delivery', { connection: bullConnection(), prefix });
  const service = new WebhookDeliveryService(new PrismaWebhooksRepository(prisma), queue);
  const processor = new WebhookDeliveryProcessor(prisma, crypto);

  let worker: Worker | null = null;
  let hooks: ReturnType<typeof receiver> | null = null;
  let baseUrl = '';
  let orgA = '';
  let orgB = '';

  const startWorker = () => {
    worker = new Worker('webhook-delivery', (job) => processor.process(job), { connection: bullConnection(), prefix });
  };

  async function seedOrg(label: string): Promise<string> {
    const user = await prisma.user.create({ data: { firebaseUid: `fb-${label}`, email: `${label}@test.dev`, isOwner: true } });
    const org = await prisma.organization.create({ data: { userId: user.id, name: `Org ${label}`, slug: `org-${label}` } });
    return org.id;
  }

  const addEndpoint = (organizationId: string, path: string, events: string[] = ['*']) =>
    runAsSystem('seed de pruebas', () =>
      prisma.webhookEndpoint.create({
        data: { organizationId, url: `${baseUrl}${path}`, events, secretEncrypted: crypto.seal(SECRET), secretPrefix: 'whsec' },
      }),
    );

  const logs = (webhookId: string) =>
    runAsSystem('leer log', () => prisma.webhookDeliveryLog.findMany({ where: { webhookId }, orderBy: { attempt: 'asc' } }));
  const endpointRow = (id: string) => runAsSystem('leer endpoint', () => prisma.webhookEndpoint.findUniqueOrThrow({ where: { id } }));

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await admin.query('TRUNCATE users, organizations RESTART IDENTITY CASCADE');
    await queue.obliterate({ force: true });
    orgA = await seedOrg('a');
    orgB = await seedOrg('b');
  });

  afterEach(async () => {
    await worker?.close();
    worker = null;
    await hooks?.close();
    hooks = null;
  });

  afterAll(async () => {
    await queue.obliterate({ force: true });
    await queue.close();
    await prisma.$disconnect();
    await admin.end();
  });

  async function withReceiver(respond: (attempt: number, path: string) => number) {
    hooks = receiver(respond);
    baseUrl = await hooks.listen();
  }

  it('entrega el evento con firma HMAC verificable, evento y timestamp; deja el log y actualiza el endpoint', async () => {
    await withReceiver(() => 200);
    const endpoint = await addEndpoint(orgA, '/hook');
    startWorker();

    await service.dispatch(orgA, 'order.created', { orderId: 'o-1' });
    await waitFor(async () => (await logs(endpoint.id)).length === 1);

    const req = hooks!.received[0]!;
    expect(req.headers['x-webhook-event']).toBe('order.created');
    expect(req.headers['x-webhook-signature']).toBe(`sha256=${createHmac('sha256', SECRET).update(req.body).digest('hex')}`);
    expect(JSON.parse(req.body)).toMatchObject({ event: 'order.created', payload: { orderId: 'o-1' } });
    const [log] = await logs(endpoint.id);
    expect(log).toMatchObject({ success: true, statusCode: 200, attempt: 1 });
    const row = await endpointRow(endpoint.id);
    expect(row.failureCount).toBe(0);
    expect(row.lastTriggeredAt).not.toBeNull();
  });

  it('reintenta con backoff: falla dos veces, la tercera entrega, y el contador de fallas vuelve a 0', async () => {
    await withReceiver((attempt) => (attempt < 3 ? 500 : 200));
    const endpoint = await addEndpoint(orgA, '/hook');
    startWorker();

    await service.dispatch(orgA, 'order.created', {});
    await waitFor(async () => (await logs(endpoint.id)).length === 3);

    expect(hooks!.received).toHaveLength(3);
    const entries = await logs(endpoint.id);
    expect(entries.map((l) => [l.attempt, l.success])).toEqual([[1, false], [2, false], [3, true]]);
    expect(entries[0]?.error).toMatch(/HTTP 500/);
    expect((await endpointRow(endpoint.id)).failureCount).toBe(0);
  }, 30_000);

  it('si el receptor siempre falla, se agota en WEBHOOK_MAX_RETRIES intentos y se cuentan las fallas', async () => {
    await withReceiver(() => 500);
    const endpoint = await addEndpoint(orgA, '/hook');
    startWorker();

    await service.dispatch(orgA, 'order.created', {});
    await waitFor(async () => (await logs(endpoint.id)).length === 3);
    await sleep(2_500); // un 4º intento no debe aparecer

    expect(hooks!.received).toHaveLength(3);
    expect((await logs(endpoint.id)).every((l) => !l.success)).toBe(true);
    expect((await endpointRow(endpoint.id)).failureCount).toBe(3);
    expect(await queue.getFailedCount()).toBe(1);
  }, 30_000);

  it('solo se entrega a los endpoints de la organización del evento', async () => {
    await withReceiver(() => 200);
    const endpointA = await addEndpoint(orgA, '/de-a');
    const endpointB = await addEndpoint(orgB, '/de-b');
    startWorker();

    await service.dispatch(orgA, 'order.created', {});
    await waitFor(async () => (await logs(endpointA.id)).length === 1);
    await sleep(500);

    expect(hooks!.received.map((r) => r.path)).toEqual(['/de-a']);
    expect(await logs(endpointB.id)).toHaveLength(0);
  });

  it('respeta el filtro de eventos del endpoint', async () => {
    await withReceiver(() => 200);
    const suscripto = await addEndpoint(orgA, '/si', ['order.created']);
    await addEndpoint(orgA, '/no', ['otro.evento']);
    startWorker();

    await service.dispatch(orgA, 'order.created', {});
    await waitFor(async () => (await logs(suscripto.id)).length === 1);
    await sleep(300);

    expect(hooks!.received.map((r) => r.path)).toEqual(['/si']);
  });

  it('el job en Redis NO lleva el secreto ni la URL (Redis no guarda material de firma)', async () => {
    await withReceiver(() => 200);
    const endpoint = await addEndpoint(orgA, '/hook');
    // sin worker: el job queda en la cola

    await service.dispatch(orgA, 'order.created', { orderId: 'o-1' });

    const [job] = await queue.getJobs(['waiting', 'delayed']);
    expect(Object.keys(job!.data as object).sort()).toEqual(['event', 'payload', 'webhookId']);
    const serialized = JSON.stringify(job!.data);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain(baseUrl);
    expect((job!.data as { webhookId: string }).webhookId).toBe(endpoint.id);
  });

  it('un endpoint desactivado entre el encolado y la entrega no recibe nada', async () => {
    await withReceiver(() => 200);
    const endpoint = await addEndpoint(orgA, '/hook');
    await service.dispatch(orgA, 'order.created', {});
    await runAsSystem('desactivar', () => prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { isActive: false } }));

    startWorker();
    await waitFor(async () => (await queue.getCompletedCount()) === 1);

    expect(hooks!.received).toHaveLength(0);
  });
});
