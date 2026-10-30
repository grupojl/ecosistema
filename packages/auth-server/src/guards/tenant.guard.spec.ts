import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { TenantGuard } from './tenant.guard';
import type { CachePort } from '@/ports/cache.port';

const fetchMock = vi.fn();

function build(opts: { isPublic?: boolean } = {}) {
  const cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), del: vi.fn() } as unknown as CachePort & { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  const reflector = { getAllAndOverride: () => opts.isPublic ?? false } as unknown as Reflector;
  return { cache, guard: new TenantGuard(cache, reflector) };
}

function ctx(req: Record<string, unknown>): ExecutionContext {
  return { getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

const authedReq = (extra: Record<string, unknown> = {}) => ({
  user: { uid: 'uid-1' },
  headers: { authorization: 'Bearer tok', 'x-organization-id': 'org-1' },
  ...extra,
});

const ok = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

describe('TenantGuard', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env['SASS_BACK_URL'] = 'http://sass';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rutas @Public no se tocan', async () => {
    const { guard } = build({ isPublic: true });
    await expect(guard.canActivate(ctx({ headers: {} }))).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin x-organization-id deja pasar sin tenant (storefront público)', async () => {
    const { guard } = build();
    const req: Record<string, unknown> = { headers: {} };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req['tenant']).toBeUndefined();
  });

  it('con organización pero sin usuario → 401', async () => {
    const { guard } = build();
    await expect(guard.canActivate(ctx({ headers: { 'x-organization-id': 'org-1' } }))).rejects.toThrow(UnauthorizedException);
  });

  it('con usuario pero sin Bearer → 401', async () => {
    const { guard } = build();
    await expect(guard.canActivate(ctx({ user: { uid: 'u' }, headers: { 'x-organization-id': 'org-1' } }))).rejects.toThrow('Bearer token requerido');
  });

  it('un esquema de autorización distinto de Bearer no sirve', async () => {
    const { guard } = build();
    const req = authedReq({ headers: { authorization: 'Basic abc', 'x-organization-id': 'org-1' } });
    await expect(guard.canActivate(ctx(req))).rejects.toThrow(UnauthorizedException);
  });

  it('usa el caché si hay acceso guardado y no llama a sass-back', async () => {
    const { cache, guard } = build();
    const tenant = { userId: 'u', organizationId: 'org-1', role: 'ADMIN', permissions: {} };
    cache.get.mockResolvedValue(tenant);
    const req = authedReq();
    await guard.canActivate(ctx(req));
    expect((req as Record<string, unknown>)['tenant']).toEqual(tenant);
    expect(cache.get).toHaveBeenCalledWith('org-access:uid-1:org-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin caché consulta a sass-back con el token, resuelve el tenant y lo cachea 90 s', async () => {
    const { cache, guard } = build();
    fetchMock.mockReturnValue(ok({ canAccess: true, userId: 'u1', role: 'OWNER', permissions: { a: true } }));
    const req = authedReq();
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://sass/api/v1/auth/organization-access');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'x-organization-id': 'org-1' });
    const tenant = { userId: 'u1', organizationId: 'org-1', role: 'OWNER', permissions: { a: true } };
    expect((req as Record<string, unknown>)['tenant']).toEqual(tenant);
    expect(cache.set).toHaveBeenCalledWith('org-access:uid-1:org-1', tenant, 90);
  });

  it('acceso denegado → 403 con el motivo, y no se cachea', async () => {
    const { cache, guard } = build();
    fetchMock.mockReturnValue(ok({ canAccess: false, reason: 'Organización suspendida' }));
    await expect(guard.canActivate(ctx(authedReq()))).rejects.toThrow('Organización suspendida');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('una respuesta "canAccess" incompleta (sin rol o userId) se rechaza', async () => {
    const { guard } = build();
    fetchMock.mockReturnValue(ok({ canAccess: true, userId: 'u1' }));
    await expect(guard.canActivate(ctx(authedReq()))).rejects.toThrow(ForbiddenException);
  });

  it('HTTP no OK de sass-back → 403', async () => {
    const { guard } = build();
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 500 } as Response));
    await expect(guard.canActivate(ctx(authedReq()))).rejects.toThrow('Sin acceso');
  });

  it('caída de sass-back → 403 (falla cerrado, nunca deja pasar)', async () => {
    const { guard } = build();
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(guard.canActivate(ctx(authedReq()))).rejects.toThrow('Error al verificar permisos');
  });

  it('sin SASS_BACK_URL configurada → 403', async () => {
    const { guard } = build();
    delete process.env['SASS_BACK_URL'];
    await expect(guard.canActivate(ctx(authedReq()))).rejects.toThrow('SASS_BACK_URL');
  });
});
