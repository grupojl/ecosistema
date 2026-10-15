/**
 * Montaje REAL de TrpcModule con el prefijo global de producción (main.ts: setGlobalPrefix('api/v1')).
 *
 * Regresión: Nest antepone el prefijo global TAMBIÉN a las rutas de middleware, así que
 * `forRoutes('/api/v1/trpc')` quedaba montado en /api/v1/api/v1/trpc y todos los clientes (que llaman a
 * /api/v1/trpc) recibían 404 ("Unable to transform response from server"). El typecheck no lo detecta.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import { ActivityModule } from '@/activity/activity.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisModule } from '@/redis/redis.module';
import { TrpcModule } from '@/trpc/trpc.module';

describe('TrpcModule montado como en producción', () => {
  let app: INestApplication;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const k of ['CUSTOMER_SESSION_SECRET', 'REDIS_ENABLED', 'ORGANIZATIONS_SERVICE_URL']) saved[k] = process.env[k];
    process.env['CUSTOMER_SESSION_SECRET'] = 'x'.repeat(48);
    process.env['REDIS_ENABLED'] = 'false';

    // PrismaModule / RedisModule / ActivityModule los provee AppModule en producción; la base se reemplaza por un doble vacío.
    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, RedisModule, ActivityModule, TrpcModule] })
      .overrideProvider(PrismaService).useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });

  const http = () => supertest(app.getHttpServer() as Parameters<typeof supertest>[0]);

  it('atiende tRPC en /api/v1/trpc (la ruta que usan todos los clientes)', async () => {
    const res = await http().post('/api/v1/trpc/customer.logout').set('x-organization-id', '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b').send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: { data: { ok: true } } });
  });

  it('NO queda montado dos veces (/api/v1/api/v1/trpc): era el bug', async () => {
    const res = await http().post('/api/v1/api/v1/trpc/customer.logout').send({});
    expect(res.status).toBe(404);
  });

  it('un procedure que no existe responde un error tRPC (no un 404 de ruta)', async () => {
    const res = await http().post('/api/v1/trpc/customer.noExiste').send({});
    expect((res.body as { error?: { data?: { code?: string } } }).error?.data?.code).toBe('NOT_FOUND');
  });

  it('el rate limit está activo en la ruta real: 11 identify desde la misma IP => 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      // organizationId inválido: el procedure rechaza (400) pero el limiter cuenta igual antes de llegar
      statuses.push((await http().post('/api/v1/trpc/customer.identify').set('x-forwarded-for', '203.0.113.9').send({ organizationId: 'x' })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('lo que pide credenciales las exige: customer.me sin cookie => UNAUTHORIZED', async () => {
    const res = await http().get('/api/v1/trpc/customer.me').set('x-organization-id', '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b');
    expect((res.body as { error?: { data?: { code?: string } } }).error?.data?.code).toBe('UNAUTHORIZED');
  });

  it('el área de administración exige sesión del dashboard: adminCatalog sin token => UNAUTHORIZED', async () => {
    const res = await http().get('/api/v1/trpc/adminCatalog.list').set('x-organization-id', '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b');
    expect((res.body as { error?: { data?: { code?: string } } }).error?.data?.code).toBe('UNAUTHORIZED');
  });
});
