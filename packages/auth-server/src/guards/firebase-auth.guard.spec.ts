/**
 * FirebaseAuthGuard — el guard que protege TODOS los endpoints de ambos backs (APP_GUARD). El norte de testing pide 100%
 * en guards: cada rama de la autenticación está probada, incluido lo que NO debe pasar.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

const verifyIdToken = vi.fn();
const verifySessionCookie = vi.fn();
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken, verifySessionCookie }) }));

import { FirebaseAuthGuard } from './firebase-auth.guard';
import { IS_PUBLIC_KEY } from '@/decorators/public.decorator';
import { SESSION_COOKIE_NAME } from '@/session/session.service';

interface FakeReq {
  headers: Record<string, string | undefined>;
  cookies?: Record<string, string | undefined>;
  user?: unknown;
}

function make(isPublic: boolean | undefined, req: FakeReq) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(isPublic) } as unknown as Reflector;
  const handler = () => undefined;
  class Controller {}
  const ctx = {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { guard: new FirebaseAuthGuard(reflector), ctx, reflector, handler, Controller };
}

beforeEach(() => {
  verifyIdToken.mockReset();
  verifySessionCookie.mockReset();
});

describe('FirebaseAuthGuard', () => {
  describe('rutas públicas (@Public)', () => {
    it('deja pasar sin mirar ningún token, y consulta el decorador en el handler Y en la clase', async () => {
      const req: FakeReq = { headers: {} };
      const { guard, ctx, reflector, handler, Controller } = make(true, req);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [handler, Controller]);
      expect(verifyIdToken).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });

  describe('sin credenciales', () => {
    it.each([
      ['sin Authorization ni cookie', { headers: {} }],
      ['Authorization con otro esquema (Basic)', { headers: { authorization: 'Basic abc' } }],
      ['Authorization vacío', { headers: { authorization: '' } }],
      ['cookies indefinidas', { headers: {}, cookies: undefined }],
      ['cookie con OTRO nombre', { headers: {}, cookies: { otra: 'x' } }],
    ] as Array<[string, FakeReq]>)('401: %s', async (_name, req) => {
      const { guard, ctx } = make(false, req);
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verifyIdToken).not.toHaveBeenCalled();
      expect(verifySessionCookie).not.toHaveBeenCalled();
    });

    it('«Bearer» sin token es 401, no se consulta a Firebase', async () => {
      const { guard, ctx } = make(false, { headers: { authorization: 'Bearer' } });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verifyIdToken).not.toHaveBeenCalled();
    });
  });

  describe('Bearer (ID token de Firebase)', () => {
    it('verifica el token y arma req.user con uid, email, nombre y foto', async () => {
      verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.com', name: 'Ana', picture: 'http://f/x.png' });
      const req: FakeReq = { headers: { authorization: 'Bearer TOKEN' } };
      const { guard, ctx } = make(false, req);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(verifyIdToken).toHaveBeenCalledWith('TOKEN'); // sin el parámetro de revocación: el token de 1 h vence solo
      expect(req.user).toEqual({ uid: 'u1', email: 'a@b.com', displayName: 'Ana', avatarUrl: 'http://f/x.png' });
    });

    it('un token sin email/nombre/foto no rompe: email vacío y nulos', async () => {
      verifyIdToken.mockResolvedValue({ uid: 'u1' });
      const req: FakeReq = { headers: { authorization: 'Bearer T' } };
      const { guard, ctx } = make(false, req);
      await guard.canActivate(ctx);
      expect(req.user).toEqual({ uid: 'u1', email: '', displayName: null, avatarUrl: null });
    });

    it('un token inválido o vencido es 401 con mensaje genérico (no filtra el motivo)', async () => {
      verifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired at 2026-01-01'));
      const req: FakeReq = { headers: { authorization: 'Bearer VIEJO' } };
      const { guard, ctx } = make(false, req);
      const error = await guard.canActivate(ctx).catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Token invalido o expirado');
      expect(error.message).not.toContain('2026');
      expect(req.user).toBeUndefined(); // nunca queda un usuario a medias
    });

    it('un error que no es Error también es 401', async () => {
      verifyIdToken.mockRejectedValue('texto');
      const { guard, ctx } = make(false, { headers: { authorization: 'Bearer T' } });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('cookie de sesión HttpOnly (ADR-004)', () => {
    it('verifica la cookie CON chequeo de revocación y arma req.user', async () => {
      verifySessionCookie.mockResolvedValue({ uid: 'u2', email: 'c@d.com' });
      const req: FakeReq = { headers: {}, cookies: { [SESSION_COOKIE_NAME]: 'COOKIE' } };
      const { guard, ctx } = make(false, req);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(verifySessionCookie).toHaveBeenCalledWith('COOKIE', true); // checkRevoked: cerrar sesión corta de inmediato
      expect(req.user).toMatchObject({ uid: 'u2', email: 'c@d.com' });
      expect(verifyIdToken).not.toHaveBeenCalled();
    });

    it('una cookie revocada o inválida es 401', async () => {
      verifySessionCookie.mockRejectedValue(new Error('session cookie revoked'));
      const { guard, ctx } = make(false, { headers: {}, cookies: { [SESSION_COOKIE_NAME]: 'REVOCADA' } });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('si hay Bearer Y cookie, manda el Bearer (la cookie no se consulta)', async () => {
      verifyIdToken.mockResolvedValue({ uid: 'bearer-user' });
      const req: FakeReq = { headers: { authorization: 'Bearer T' }, cookies: { [SESSION_COOKIE_NAME]: 'COOKIE' } };
      const { guard, ctx } = make(false, req);
      await guard.canActivate(ctx);
      expect(req.user).toMatchObject({ uid: 'bearer-user' });
      expect(verifySessionCookie).not.toHaveBeenCalled();
    });

    it('un Bearer inválido NO cae a la cookie (no se puede "rescatar" un token malo con una cookie válida)', async () => {
      verifyIdToken.mockRejectedValue(new Error('bad'));
      const { guard, ctx } = make(false, { headers: { authorization: 'Bearer MALO' }, cookies: { [SESSION_COOKIE_NAME]: 'COOKIE-BUENA' } });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verifySessionCookie).not.toHaveBeenCalled();
    });
  });

  it('un @Public indefinido (sin decorador) exige autenticación', async () => {
    const { guard, ctx } = make(undefined, { headers: {} });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
