import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { CachePort } from '@/ports/cache.port';
import type { TenantGuard as TenantGuardType } from './tenant.guard';

const ORG = 'org-1';
const ACCESS_OK = { canAccess: true, userId: 'u1', organizationId: ORG, role: 'OWNER', permissions: { canViewListings: true } };

const jsonResponse = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as Response;

function ctxFor(req: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}), getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const authedReq = (extra: Record<string, unknown> = {}) => ({
  user: { uid: 'firebase-uid' },
  headers: { authorization: 'Bearer tok', 'x-organization-id': ORG },
  ...extra,
});

describe('TenantGuard', () => {
  let TenantGuard: typeof TenantGuardType;
  let cache: { get: jest.Mock; set: jest.Mock };
  let guard: TenantGuardType;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    // El circuit breaker es estado de módulo: cada test arranca con uno nuevo.
    // (Por eso se compara el status HTTP y no instanceof: resetModules duplica las clases de Nest.)
    jest.resetModules();
    ({ TenantGuard } = jest.requireActual<typeof import('./tenant.guard')>('./tenant.guard'));
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    guard = new TenantGuard(cache as unknown as CachePort, { getAllAndOverride: () => false } as unknown as Reflector);
    process.env['SASS_BACK_URL'] = 'http://sass-back.test';
    fetchSpy = jest.spyOn(global, 'fetch');
  });
  afterEach(() => { fetchSpy.mockRestore(); delete process.env['SASS_BACK_URL']; });

  it('sin x-organization-id (storefront público) no resuelve tenant y deja pasar', async () => {
    const req = { headers: {} };
    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('con organización exige usuario autenticado y Bearer token', async () => {
    await expect(guard.canActivate(ctxFor({ headers: { 'x-organization-id': ORG } }))).rejects.toMatchObject({ status: 401 });
    await expect(guard.canActivate(ctxFor({ user: { uid: 'u' }, headers: { 'x-organization-id': ORG } }))).rejects.toMatchObject({ status: 401 });
  });

  it('resuelve el tenant contra sass-back, lo cachea y lo deja en req.tenant', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, ACCESS_OK));
    const req = authedReq();

    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);

    expect((req as { tenant?: unknown }).tenant).toMatchObject({ userId: 'u1', organizationId: ORG, role: 'OWNER' });
    expect(cache.set).toHaveBeenCalledWith(`org-access:firebase-uid:${ORG}`, expect.anything(), 90);
    // la llamada lleva timeout (AbortSignal) y el header de organización
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.headers as Record<string, string>)['x-organization-id']).toBe(ORG);
  });

  it('cache hit: no llama a sass-back', async () => {
    cache.get.mockResolvedValue({ userId: 'u1', organizationId: ORG, role: 'OWNER', permissions: {} });
    await expect(guard.canActivate(ctxFor(authedReq()))).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('403 de sass-back => Forbidden, y NO cuenta como falla del servicio (el breaker sigue cerrado)', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(403));
    for (let i = 0; i < 8; i++) await expect(guard.canActivate(ctxFor(authedReq()))).rejects.toMatchObject({ status: 403 });
    expect(fetchSpy).toHaveBeenCalledTimes(8); // nunca se abrió el circuito
  });

  it('canAccess=false => Forbidden con el motivo', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, { canAccess: false, reason: 'No access' }));
    await expect(guard.canActivate(ctxFor(authedReq()))).rejects.toThrow('No access');
  });

  it('5xx o red caída => 503 (no 403: no es un problema de permisos del usuario)', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(502));
    await expect(guard.canActivate(ctxFor(authedReq()))).rejects.toMatchObject({ status: 503 });
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(guard.canActivate(ctxFor(authedReq()))).rejects.toMatchObject({ status: 503 });
  });

  it('circuit breaker: tras 5 fallos corta y deja de llamar a sass-back (falla rápido con 503)', async () => {
    fetchSpy.mockRejectedValue(new Error('timeout'));
    for (let i = 0; i < 5; i++) await expect(guard.canActivate(ctxFor(authedReq()))).rejects.toMatchObject({ status: 503 });
    expect(fetchSpy).toHaveBeenCalledTimes(5);

    await expect(guard.canActivate(ctxFor(authedReq()))).rejects.toMatchObject({ status: 503 });
    expect(fetchSpy).toHaveBeenCalledTimes(5); // la 6.ª ni siquiera salió
  });

  it('sin SASS_BACK_URL falla cerrado', async () => {
    delete process.env['SASS_BACK_URL'];
    await expect(guard.canActivate(ctxFor(authedReq()))).rejects.toMatchObject({ status: 403 });
  });
});
