import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const verifyIdToken = vi.fn();
const verifySessionCookie = vi.fn();
vi.mock('@/firebase/firebase.module', () => ({
  getFirebaseAdmin: () => ({ verifyIdToken, verifySessionCookie }),
}));

import { createTrpcAuthMiddleware } from './create-trpc-auth-middleware';

type Req = Record<string, unknown> & { headers: Record<string, string | undefined>; cookies?: Record<string, string> };
const res = {} as Response;
const asReq = (r: Req) => r as unknown as Request;

const decoded = { uid: 'uid-1', email: 'a@x.com', name: 'Ana', picture: 'http://p', email_verified: true };

describe('createTrpcAuthMiddleware — firebaseAuth', () => {
  beforeEach(() => { verifyIdToken.mockReset(); verifySessionCookie.mockReset(); });

  function setup(isSessionRevoked?: (sid: string, uid: string) => Promise<boolean>) {
    const getOrganizationAccess = vi.fn();
    return { getOrganizationAccess, ...createTrpcAuthMiddleware({ getOrganizationAccess, isSessionRevoked }) };
  }

  it('sin Bearer ni cookie: sigue sin usuario (la ruta decide si exige auth)', async () => {
    const { firebaseAuth } = setup();
    const req: Req = { headers: {} };
    const next = vi.fn();
    await firebaseAuth(asReq(req), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req['user']).toBeUndefined();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('Bearer válido: inyecta usuario y el token crudo', async () => {
    const { firebaseAuth } = setup();
    verifyIdToken.mockResolvedValue(decoded);
    const req: Req = { headers: { authorization: 'Bearer abc' } };
    await firebaseAuth(asReq(req), res, vi.fn());
    expect(verifyIdToken).toHaveBeenCalledWith('abc');
    expect(req['firebaseToken']).toBe('abc');
    expect(req['user']).toEqual({ uid: 'uid-1', email: 'a@x.com', displayName: 'Ana', avatarUrl: 'http://p', emailVerified: true });
  });

  it('emailVerified solo es true si Firebase lo confirma', async () => {
    const { firebaseAuth } = setup();
    verifyIdToken.mockResolvedValue({ uid: 'u', email_verified: undefined });
    const req: Req = { headers: { authorization: 'Bearer abc' } };
    await firebaseAuth(asReq(req), res, vi.fn());
    expect((req['user'] as { emailVerified: boolean }).emailVerified).toBe(false);
    expect((req['user'] as { email: string }).email).toBe('');
  });

  it('Bearer inválido: no hay usuario, pero el flujo continúa (enforceAuth lo rechaza)', async () => {
    const { firebaseAuth } = setup();
    verifyIdToken.mockRejectedValue(new Error('expirado'));
    const req: Req = { headers: { authorization: 'Bearer malo' } };
    const next = vi.fn();
    await firebaseAuth(asReq(req), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req['user']).toBeUndefined();
  });

  it('una cabecera que no es "Bearer " se ignora', async () => {
    const { firebaseAuth } = setup();
    const req: Req = { headers: { authorization: 'Basic abc' } };
    await firebaseAuth(asReq(req), res, vi.fn());
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(req['user']).toBeUndefined();
  });

  it('cookie __session: se verifica con revocación (checkRevoked) y no hay token crudo', async () => {
    const { firebaseAuth } = setup();
    verifySessionCookie.mockResolvedValue(decoded);
    const req: Req = { headers: {}, cookies: { __session: 'cookie-1' } };
    await firebaseAuth(asReq(req), res, vi.fn());
    expect(verifySessionCookie).toHaveBeenCalledWith('cookie-1', true);
    expect(req['firebaseToken']).toBeUndefined();
    expect((req['user'] as { uid: string }).uid).toBe('uid-1');
  });

  it('si llegan Bearer Y cookie manda el Bearer', async () => {
    const { firebaseAuth } = setup();
    verifyIdToken.mockResolvedValue(decoded);
    const req: Req = { headers: { authorization: 'Bearer abc' }, cookies: { __session: 'cookie-1' } };
    await firebaseAuth(asReq(req), res, vi.fn());
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it('ADR-020: una sesión cerrada desde "Dispositivos" no autentica', async () => {
    const isSessionRevoked = vi.fn().mockResolvedValue(true);
    const { firebaseAuth } = setup(isSessionRevoked);
    verifySessionCookie.mockResolvedValue(decoded);
    const req: Req = { headers: {}, cookies: { __session: 'c', __sid: 'sid-9' } };
    const next = vi.fn();
    await firebaseAuth(asReq(req), res, next);
    expect(isSessionRevoked).toHaveBeenCalledWith('sid-9', 'uid-1');
    expect(req['user']).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('una sesión no revocada autentica; sin __sid (cookies viejas) no se consulta', async () => {
    const isSessionRevoked = vi.fn().mockResolvedValue(false);
    const { firebaseAuth } = setup(isSessionRevoked);
    verifySessionCookie.mockResolvedValue(decoded);

    const conSid: Req = { headers: {}, cookies: { __session: 'c', __sid: 'sid-1' } };
    await firebaseAuth(asReq(conSid), res, vi.fn());
    expect(conSid['user']).toBeDefined();

    isSessionRevoked.mockClear();
    const sinSid: Req = { headers: {}, cookies: { __session: 'c' } };
    await firebaseAuth(asReq(sinSid), res, vi.fn());
    expect(sinSid['user']).toBeDefined();
    expect(isSessionRevoked).not.toHaveBeenCalled();
  });

  it('con Bearer no se consulta la revocación de sesión', async () => {
    const isSessionRevoked = vi.fn().mockResolvedValue(true);
    const { firebaseAuth } = setup(isSessionRevoked);
    verifyIdToken.mockResolvedValue(decoded);
    const req: Req = { headers: { authorization: 'Bearer abc' }, cookies: { __sid: 'sid-1' } };
    await firebaseAuth(asReq(req), res, vi.fn());
    expect(isSessionRevoked).not.toHaveBeenCalled();
    expect(req['user']).toBeDefined();
  });
});

describe('createTrpcAuthMiddleware — tenantContext', () => {
  const build = () => {
    const getOrganizationAccess = vi.fn();
    return { getOrganizationAccess, ...createTrpcAuthMiddleware({ getOrganizationAccess }) };
  };

  it('sin x-organization-id no resuelve tenant', async () => {
    const { tenantContext, getOrganizationAccess } = build();
    const next = vi.fn();
    await tenantContext(asReq({ headers: {}, user: { uid: 'u' } }), res, next);
    expect(getOrganizationAccess).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sin usuario autenticado no resuelve tenant (aunque mande el header)', async () => {
    const { tenantContext, getOrganizationAccess } = build();
    const req: Req = { headers: { 'x-organization-id': 'org-1' } };
    await tenantContext(asReq(req), res, vi.fn());
    expect(getOrganizationAccess).not.toHaveBeenCalled();
    expect(req['tenant']).toBeUndefined();
  });

  it('acceso concedido: inyecta el tenant con el id de la organización pedida', async () => {
    const { tenantContext, getOrganizationAccess } = build();
    getOrganizationAccess.mockResolvedValue({ canAccess: true, userId: 'u1', role: 'ADMIN', permissions: { x: true } });
    const req: Req = { headers: { 'x-organization-id': 'org-1' }, user: { uid: 'uid-1' }, firebaseToken: 'tok' };
    await tenantContext(asReq(req), res, vi.fn());
    expect(getOrganizationAccess).toHaveBeenCalledWith('tok', 'uid-1', 'org-1');
    expect(req['tenant']).toEqual({ userId: 'u1', organizationId: 'org-1', role: 'ADMIN', permissions: { x: true } });
  });

  it('por cookie (sin token crudo) pasa un token vacío', async () => {
    const { tenantContext, getOrganizationAccess } = build();
    getOrganizationAccess.mockResolvedValue({ canAccess: false });
    await tenantContext(asReq({ headers: { 'x-organization-id': 'o' }, user: { uid: 'u' } }), res, vi.fn());
    expect(getOrganizationAccess).toHaveBeenCalledWith('', 'u', 'o');
  });

  it('acceso denegado o incompleto: no hay tenant', async () => {
    const { tenantContext, getOrganizationAccess } = build();
    for (const access of [{ canAccess: false }, { canAccess: true, userId: 'u1' }, { canAccess: true, role: 'OWNER' }]) {
      getOrganizationAccess.mockResolvedValue(access);
      const req: Req = { headers: { 'x-organization-id': 'o' }, user: { uid: 'u' } };
      await tenantContext(asReq(req), res, vi.fn());
      expect(req['tenant']).toBeUndefined();
    }
  });

  it('si resolver el acceso falla, no hay tenant y el flujo continúa', async () => {
    const { tenantContext, getOrganizationAccess } = build();
    getOrganizationAccess.mockRejectedValue(new Error('sass-back caído'));
    const req: Req = { headers: { 'x-organization-id': 'o' }, user: { uid: 'u' } };
    const next = vi.fn();
    await tenantContext(asReq(req), res, next);
    expect(req['tenant']).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rechaza un x-organization-id que no es string (cabecera repetida)', async () => {
    const { tenantContext, getOrganizationAccess } = build();
    const req = { headers: { 'x-organization-id': ['a', 'b'] }, user: { uid: 'u' } } as unknown as Request;
    await tenantContext(req, res, vi.fn());
    expect(getOrganizationAccess).not.toHaveBeenCalled();
  });
});
