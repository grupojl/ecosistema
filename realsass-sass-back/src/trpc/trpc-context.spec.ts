import type { Request } from 'express';
import { TRPCError } from '@trpc/server';
import { ZodError, z } from 'zod';
import { BadRequestException } from '@nestjs/common';
import { createTrpcContext } from '@/trpc/trpc';
import { router, publicProcedure } from '@/trpc';
import { QuotaExceededException } from '@/common/exceptions/quota-exceeded.exception';
import { AppCodeError } from '@/trpc/app-code-error';

const ctxFor = (req: Partial<Request> & Record<string, unknown>) => createTrpcContext({ req: { headers: {}, ...req } as Request, res: {} as never, info: {} as never });

describe('createTrpcContext', () => {
  it('sin usuario ni tenant => todo null (sesión anónima)', () => {
    expect(ctxFor({})).toMatchObject({ uid: null, organizationId: null, role: null });
  });

  it('toma uid, organización y rol de lo que resolvieron los guards (req.user / req.tenant)', () => {
    const ctx = ctxFor({ user: { uid: 'u1' }, tenant: { organizationId: 'org-1', role: 'OWNER' } });

    expect(ctx).toMatchObject({ uid: 'u1', organizationId: 'org-1', role: 'OWNER' });
  });

  it('SEGURIDAD: el header x-organization-id llena organizationId pero NUNCA el rol (no concede acceso)', () => {
    const ctx = ctxFor({ user: { uid: 'u1' }, headers: { 'x-organization-id': 'org-AJENA' } });

    expect(ctx.organizationId).toBe('org-AJENA');
    expect(ctx.role).toBeNull();
  });

  it('REGRESIÓN: el tenant verificado manda sobre el header', () => {
    const ctx = ctxFor({ user: { uid: 'u1' }, tenant: { organizationId: 'org-1', role: 'COLLABORATOR' }, headers: { 'x-organization-id': 'org-AJENA' } });

    expect(ctx.organizationId).toBe('org-1');
  });
});

describe('errorFormatter y traducción de errores', () => {
  type Formatter = (opts: { error: TRPCError; shape: { message: string; code: number; data: Record<string, unknown> } }) => { message: string; data: Record<string, unknown> };
  const appRouter = router({ ping: publicProcedure.input(z.object({ n: z.number() })).query(() => 'pong') });
  const formatter = (appRouter._def._config as unknown as { errorFormatter: Formatter }).errorFormatter;
  const shapeOf = (code: string) => ({ message: 'detalle interno de Prisma: select * from users', code: -32603, data: { code } });
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => { process.env['NODE_ENV'] = originalEnv; });

  it('en PRODUCCIÓN un error inesperado no expone su mensaje (puede traer SQL, rutas, detalles de Prisma)', () => {
    process.env['NODE_ENV'] = 'production';
    const error = new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: new Error('x') });

    expect(formatter({ error, shape: shapeOf('INTERNAL_SERVER_ERROR') }).message).toBe('Error interno del servidor');
  });

  it('en producción un error de NEGOCIO conserva su mensaje', () => {
    process.env['NODE_ENV'] = 'production';
    const error = new TRPCError({ code: 'NOT_FOUND', message: 'Webhook no encontrado' });

    expect(formatter({ error, shape: { ...shapeOf('NOT_FOUND'), message: 'Webhook no encontrado' } }).message).toBe('Webhook no encontrado');
  });

  it('fuera de producción el detalle se ve (útil para depurar)', () => {
    process.env['NODE_ENV'] = 'development';
    const error = new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    expect(formatter({ error, shape: shapeOf('INTERNAL_SERVER_ERROR') }).message).toContain('Prisma');
  });

  it('expone los issues de Zod, el appCode y los datos de cuota', () => {
    const zod = (() => { try { z.object({ n: z.number() }).parse({ n: 'x' }); } catch (e) { return e as ZodError; } throw new Error('no falló'); })();
    const fromZod = formatter({ error: new TRPCError({ code: 'BAD_REQUEST', cause: zod }), shape: shapeOf('BAD_REQUEST') });
    expect(fromZod.data['zodError']).toEqual(zod.issues);

    const fromApp = formatter({ error: new TRPCError({ code: 'FORBIDDEN', cause: new AppCodeError('REAUTH_REQUIRED', 'x') }), shape: shapeOf('FORBIDDEN') });
    expect(fromApp.data['appCode']).toBe('REAUTH_REQUIRED');

    const quota = formatter({ error: new TRPCError({ code: 'TOO_MANY_REQUESTS', cause: new QuotaExceededException('products', 10, 10) }), shape: shapeOf('TOO_MANY_REQUESTS') });
    expect(quota.data['appCode']).toBe('QUOTA_EXCEEDED');
    expect(quota.data['quota']).toEqual({ resource: 'products', limit: 10, current: 10 });
  });

  it('sin causa especial, appCode/zodError/quota son null', () => {
    const plain = formatter({ error: new TRPCError({ code: 'NOT_FOUND' }), shape: shapeOf('NOT_FOUND') });

    expect(plain.data).toMatchObject({ appCode: null, zodError: null, quota: null });
  });

  it('una excepción HTTP de Nest con lista de mensajes llega unida y con su código tRPC', async () => {
    const r = router({ falla: publicProcedure.query(() => { throw new BadRequestException(['a', 'b']); }) });

    await expect(r.createCaller({ req: {} as Request, uid: null, organizationId: null, role: null }).falla())
      .rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'a, b' });
  });
});
