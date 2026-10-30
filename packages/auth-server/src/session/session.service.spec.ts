import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

const admin = {
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  verifySessionCookie: vi.fn(),
  revokeRefreshTokens: vi.fn(),
};
vi.mock('@/firebase/firebase.module', () => ({ getFirebaseAdmin: () => admin }));

import { SESSION_COOKIE_MAX_AGE_MS, SessionService } from './session.service';

describe('SessionService', () => {
  const service = new SessionService();
  const original = process.env['COOKIE_DOMAIN'];

  beforeEach(() => Object.values(admin).forEach((f) => f.mockReset()));
  afterEach(() => {
    if (original === undefined) delete process.env['COOKIE_DOMAIN'];
    else process.env['COOKIE_DOMAIN'] = original;
  });

  describe('createSessionCookie', () => {
    it('verifica el token (con revocación) y crea la cookie de 14 días', async () => {
      admin.verifyIdToken.mockResolvedValue({});
      admin.createSessionCookie.mockResolvedValue('cookie-nueva');
      await expect(service.createSessionCookie('id-token')).resolves.toBe('cookie-nueva');
      expect(admin.verifyIdToken).toHaveBeenCalledWith('id-token', true);
      expect(admin.createSessionCookie).toHaveBeenCalledWith('id-token', { expiresIn: 14 * 24 * 60 * 60 * 1000 });
    });

    it('un token inválido o revocado → 401 y no se crea cookie', async () => {
      admin.verifyIdToken.mockRejectedValue(new Error('revoked'));
      await expect(service.createSessionCookie('malo')).rejects.toThrow(UnauthorizedException);
      expect(admin.createSessionCookie).not.toHaveBeenCalled();
    });
  });

  describe('verifySessionCookie', () => {
    it('devuelve uid y email verificando revocación', async () => {
      admin.verifySessionCookie.mockResolvedValue({ uid: 'u1', email: 'a@x.com', otro: 'x' });
      await expect(service.verifySessionCookie('c')).resolves.toEqual({ uid: 'u1', email: 'a@x.com' });
      expect(admin.verifySessionCookie).toHaveBeenCalledWith('c', true);
    });

    it('una cookie inválida → 401', async () => {
      admin.verifySessionCookie.mockRejectedValue(new Error('x'));
      await expect(service.verifySessionCookie('c')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('revokeSession', () => {
    it('revoca los refresh tokens del usuario', async () => {
      admin.revokeRefreshTokens.mockResolvedValue(undefined);
      await service.revokeSession('u1');
      expect(admin.revokeRefreshTokens).toHaveBeenCalledWith('u1');
    });

    it('un fallo de Firebase no rompe el cierre de sesión', async () => {
      admin.revokeRefreshTokens.mockRejectedValue(new Error('x'));
      await expect(service.revokeSession('u1')).resolves.toBeUndefined();
    });
  });

  describe('cookies', () => {
    it('HttpOnly, SameSite=strict, 14 días y path /', () => {
      delete process.env['COOKIE_DOMAIN'];
      expect(service.getCookieOptions()).toEqual({
        httpOnly: true, secure: true, sameSite: 'strict', maxAge: SESSION_COOKIE_MAX_AGE_MS, path: '/',
      });
    });

    it('en desarrollo se puede emitir sin Secure', () => {
      expect(service.cookieOptions(false).secure).toBe(false);
    });

    it('COOKIE_DOMAIN se aplica al emitir y al borrar (si no coincide, el navegador no la elimina)', () => {
      process.env['COOKIE_DOMAIN'] = ' .midominio.com ';
      expect(service.getCookieOptions().domain).toBe('.midominio.com');
      expect(service.getClearCookieOptions().domain).toBe('.midominio.com');
    });

    it('sin COOKIE_DOMAIN o vacío no se define dominio (host-only)', () => {
      delete process.env['COOKIE_DOMAIN'];
      expect('domain' in service.getCookieOptions()).toBe(false);
      process.env['COOKIE_DOMAIN'] = '   ';
      expect('domain' in service.getCookieOptions()).toBe(false);
    });

    it('borrar usa maxAge 0 y conserva las banderas de seguridad', () => {
      delete process.env['COOKIE_DOMAIN'];
      expect(service.getClearCookieOptions()).toMatchObject({ maxAge: 0, httpOnly: true, secure: true, sameSite: 'strict' });
    });
  });
});
