import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthSessionThrottledController } from '@/auth/auth-session-throttled.controller';
import type { SessionService } from '@real/auth-server';

const COOKIE = 'session';
jest.mock('@real/auth-server', () => ({
  ...jest.requireActual('@real/auth-server'),
  SESSION_COOKIE_NAME: 'session',
}));

describe('AuthSessionThrottledController (POST/DELETE /auth/session — ADR-004)', () => {
  const sessions = {
    createSessionCookie: jest.fn(),
    getCookieOptions: jest.fn(() => ({ httpOnly: true, secure: true, sameSite: 'lax' })),
    getClearCookieOptions: jest.fn(() => ({ httpOnly: true, maxAge: 0 })),
    revokeSession: jest.fn(),
  };
  const controller = new AuthSessionThrottledController(sessions as unknown as SessionService);
  const res = () => ({ cookie: jest.fn() }) as unknown as Response & { cookie: jest.Mock };

  beforeEach(() => jest.clearAllMocks());

  describe('createSession', () => {
    it.each([[undefined], [''], [null]])('sin idToken (%p) => 401 y no se crea ninguna cookie', async (idToken) => {
      const response = res();

      await expect(controller.createSession(idToken as unknown as string, response)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.createSessionCookie).not.toHaveBeenCalled();
      expect(response.cookie).not.toHaveBeenCalled();
    });

    it('si Firebase rechaza el token, el error se propaga y NO se setea cookie', async () => {
      sessions.createSessionCookie.mockRejectedValue(new UnauthorizedException('token inválido'));
      const response = res();

      await expect(controller.createSession('malo', response)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(response.cookie).not.toHaveBeenCalled();
    });

    it('token válido: setea la cookie de sesión con las opciones seguras del SessionService', async () => {
      sessions.createSessionCookie.mockResolvedValue('cookie-firmada');
      const response = res();

      await expect(controller.createSession('id-token', response)).resolves.toEqual({ ok: true });

      expect(response.cookie).toHaveBeenCalledWith(COOKIE, 'cookie-firmada', { httpOnly: true, secure: true, sameSite: 'lax' });
    });

    it('REGRESIÓN: el endpoint conserva el throttle estricto de 10 req/min (anti fuerza bruta)', () => {
      const limit = Reflect.getMetadata('THROTTLER:LIMITauth', AuthSessionThrottledController.prototype.createSession) as number | undefined;
      const ttl = Reflect.getMetadata('THROTTLER:TTLauth', AuthSessionThrottledController.prototype.createSession) as number | undefined;

      expect(limit).toBe(10);
      expect(ttl).toBe(60_000);
    });
  });

  describe('deleteSession', () => {
    it('revoca la sesión del usuario autenticado y limpia la cookie', async () => {
      const response = res();

      await expect(controller.deleteSession({ uid: 'u1' } as never, response)).resolves.toEqual({ ok: true });

      expect(sessions.revokeSession).toHaveBeenCalledWith('u1');
      expect(response.cookie).toHaveBeenCalledWith(COOKIE, '', { httpOnly: true, maxAge: 0 });
    });

    it('si la revocación falla NO limpia la cookie en silencio (el error se propaga)', async () => {
      sessions.revokeSession.mockRejectedValue(new Error('firebase caído'));
      const response = res();

      await expect(controller.deleteSession({ uid: 'u1' } as never, response)).rejects.toThrow('firebase caído');
      expect(response.cookie).not.toHaveBeenCalled();
    });
  });
});
