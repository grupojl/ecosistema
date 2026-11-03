/**
 * Las excepciones de Nest que lanzan los services deben llegar al front con su código real, no como
 * INTERNAL_SERVER_ERROR. El front usa el código (NOT_FOUND, CONFLICT, QUOTA_EXCEEDED…) para decidir qué mostrar.
 */
import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { QuotaExceededException } from '@/common/exceptions/quota-exceeded.exception';
import { AppCodeError } from '@/trpc/app-code-error';
import { authProcedure, createTrpcContext, ownerProcedure, publicProcedure, router, tenantProcedure } from './trpc';

const throwing = (error: Error) => async (): Promise<never> => {
  throw error;
};

const t = router({
  pub: publicProcedure.query(throwing(new NotFoundException('no está'))),
  auth: authProcedure.query(throwing(new ForbiddenException('prohibido'))),
  tenant: tenantProcedure.query(throwing(new ConflictException('duplicado'))),
  owner: ownerProcedure.query(throwing(new BadRequestException(['a mal', 'b mal']))),
  quota: tenantProcedure.query(throwing(new QuotaExceededException('products', 10, 10))),
  limit: publicProcedure.query(throwing(new HttpException('demasiado', 429))),
  teapot: publicProcedure.query(throwing(new HttpException('teapot', 418))),
  appCode: publicProcedure.query(throwing(new AppCodeError('REAUTH_REQUIRED', 'confirmá tu identidad') as never)),
  boom: publicProcedure.query(throwing(new Error('falla real'))),
});

const ctx = (over: Record<string, unknown> = {}) => ({ req: { headers: {} }, uid: 'u', organizationId: 'o', role: 'OWNER', ...over }) as never;
const err = (p: Promise<unknown>) => p.then(() => null, (e: { code: string; message: string; data?: unknown; cause?: unknown }) => e);

describe('mapeo de excepciones de Nest a códigos tRPC (sass-back)', () => {
  it.each([
    ['pub', 'NOT_FOUND'],
    ['auth', 'FORBIDDEN'],
    ['tenant', 'CONFLICT'],
    ['owner', 'BAD_REQUEST'],
    ['limit', 'TOO_MANY_REQUESTS'],
    ['teapot', 'INTERNAL_SERVER_ERROR'],
    ['boom', 'INTERNAL_SERVER_ERROR'],
  ] as const)('%s → %s', async (name, code) => {
    const e = await err((t.createCaller(ctx()) as never as Record<string, () => Promise<unknown>>)[name]!());
    expect(e?.code).toBe(code);
  });

  it('los mensajes de validación en lista se unen', async () => {
    const e = await err(t.createCaller(ctx()).owner());
    expect(e?.message).toBe('a mal, b mal');
  });

  it('QuotaExceededException se traduce a TOO_MANY_REQUESTS (el detalle viaja en el errorFormatter)', async () => {
    const e = await err(t.createCaller(ctx()).quota());
    expect(e?.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('createTrpcContext', () => {
  const build = (req: Record<string, unknown>) => createTrpcContext({ req } as never);

  it('toma uid, organización y rol del usuario/tenant ya validados por los guards', () => {
    const c = build({ headers: {}, user: { uid: 'u1' }, tenant: { organizationId: 'org-1', role: 'OWNER' } });
    expect(c).toMatchObject({ uid: 'u1', organizationId: 'org-1', role: 'OWNER' });
  });

  it('sin tenant usa el header x-organization-id (los procedures lo validan)', () => {
    const c = build({ headers: { 'x-organization-id': 'org-9' }, user: { uid: 'u1' } });
    expect(c).toMatchObject({ uid: 'u1', organizationId: 'org-9', role: null });
  });

  it('sin sesión todo es null', () => {
    expect(build({ headers: {} })).toMatchObject({ uid: null, organizationId: null, role: null });
  });

  it('el tenant validado gana sobre el header (un header falso no cambia de organización)', () => {
    const c = build({ headers: { 'x-organization-id': 'org-ajena' }, user: { uid: 'u1' }, tenant: { organizationId: 'org-1', role: 'OWNER' } });
    expect(c.organizationId).toBe('org-1');
  });
});
