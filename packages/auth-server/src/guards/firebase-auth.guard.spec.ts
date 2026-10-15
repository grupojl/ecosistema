import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { getAuth } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from './firebase-auth.guard';

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

const auth = { verifyIdToken: jest.fn(), verifySessionCookie: jest.fn() };

function run(req: Record<string, unknown>, isPublic = false) {
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  const ctx = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return new FirebaseAuthGuard(reflector).canActivate(ctx);
}

describe('FirebaseAuthGuard', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue(auth);
    auth.verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.co', name: 'Ana', picture: 'http://p' });
    auth.verifySessionCookie.mockResolvedValue({ uid: 'u2', email: 'c@d.co' });
  });

  it('@Public() no pide nada', async () => {
    await expect(run({ headers: {} }, true)).resolves.toBe(true);
    expect(auth.verifyIdToken).not.toHaveBeenCalled();
  });

  it('sin Bearer ni cookie => 401', async () => {
    await expect(run({ headers: {} })).rejects.toMatchObject({ status: 401 });
    await expect(run({ headers: {}, cookies: {} })).rejects.toMatchObject({ status: 401 });
  });

  it('Bearer válido => deja req.user con uid, email, nombre y avatar', async () => {
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer tok' } };
    await expect(run(req)).resolves.toBe(true);
    expect(auth.verifyIdToken).toHaveBeenCalledWith('tok');
    expect(req['user']).toEqual({ uid: 'u1', email: 'a@b.co', displayName: 'Ana', avatarUrl: 'http://p' });
  });

  it('cookie de sesión (ADR-004) se verifica CON chequeo de revocación', async () => {
    const req: Record<string, unknown> = { headers: {}, cookies: { __session: 'cookie-tok' } };
    await expect(run(req)).resolves.toBe(true);
    expect(auth.verifySessionCookie).toHaveBeenCalledWith('cookie-tok', true); // checkRevoked = true
    expect(req['user']).toMatchObject({ uid: 'u2', displayName: null, avatarUrl: null });
  });

  it('si hay Bearer y cookie, manda el Bearer', async () => {
    await run({ headers: { authorization: 'Bearer tok' }, cookies: { __session: 'c' } });
    expect(auth.verifyIdToken).toHaveBeenCalled();
    expect(auth.verifySessionCookie).not.toHaveBeenCalled();
  });

  it('un esquema que no es Bearer se ignora (Basic no autentica)', async () => {
    await expect(run({ headers: { authorization: 'Basic abc' } })).rejects.toMatchObject({ status: 401 });
    expect(auth.verifyIdToken).not.toHaveBeenCalled();
  });

  it('token inválido, vencido o revocado => 401 con mensaje genérico (no filtra el motivo de Firebase)', async () => {
    auth.verifyIdToken.mockRejectedValue(new Error('Firebase ID token has been revoked: detalle interno'));
    const err = await run({ headers: { authorization: 'Bearer malo' } }).catch((e: Error) => e);
    expect(err).toMatchObject({ status: 401 });
    expect((err as Error).message).toBe('Token invalido o expirado');
    expect((err as Error).message).not.toContain('revoked');
  });
});
