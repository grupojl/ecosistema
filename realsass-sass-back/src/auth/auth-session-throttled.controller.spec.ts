import { UnauthorizedException } from '@nestjs/common';
import { SESSION_COOKIE_NAME, SESSION_ID_COOKIE_NAME } from '@real/auth-server';
import { AuthSessionThrottledController } from './auth-session-throttled.controller';

const COOKIE_OPTS = { httpOnly: true, secure: true, sameSite: 'strict' as const };
const CLEAR_OPTS = { ...COOKIE_OPTS, maxAge: 0 };

const make = () => {
  const sessionService = {
    createSessionCookie: jest.fn().mockResolvedValue('SESSION-COOKIE'),
    verifySessionCookie: jest.fn().mockResolvedValue({ uid: 'uid-1' }),
    revokeSession: jest.fn().mockResolvedValue(undefined),
    getCookieOptions: jest.fn().mockReturnValue(COOKIE_OPTS),
    getClearCookieOptions: jest.fn().mockReturnValue(CLEAR_OPTS),
  };
  const sessionsService = {
    register: jest.fn().mockResolvedValue('SID-1'),
    revokeAll: jest.fn().mockResolvedValue(undefined),
    wasRevokedAfterLogin: jest.fn().mockResolvedValue(false),
  };
  const res = { cookie: jest.fn() };
  const req = { headers: { 'user-agent': 'UA', 'cf-ipcountry': 'AR' }, ip: '1.2.3.4', cookies: { [SESSION_ID_COOKIE_NAME]: 'SID-OLD' } };
  const ctrl = new AuthSessionThrottledController(sessionService as never, sessionsService as never);
  return { ctrl, sessionService, sessionsService, res, req };
};

describe('POST /auth/session (cookie HttpOnly, ADR-004)', () => {
  it('sin idToken: 401 y no crea nada', async () => {
    const { ctrl, sessionService, res, req } = make();
    await expect(ctrl.createSession('', req as never, res as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionService.createSessionCookie).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('un idToken inválido propaga el error (no se setea ninguna cookie)', async () => {
    const { ctrl, sessionService, res, req } = make();
    sessionService.createSessionCookie.mockRejectedValue(new UnauthorizedException('token inválido'));
    await expect(ctrl.createSession('malo', req as never, res as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('crea la cookie de sesión HttpOnly y registra el dispositivo con su sid (renovando el anterior)', async () => {
    const { ctrl, sessionsService, res, req } = make();
    expect(await ctrl.createSession('ID-TOKEN', req as never, res as never)).toEqual({ ok: true });
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, 'SESSION-COOKIE', COOKIE_OPTS);
    expect(sessionsService.register).toHaveBeenCalledWith('uid-1', { userAgent: 'UA', ip: '1.2.3.4', countryHeader: 'AR' }, 'SID-OLD');
    expect(res.cookie).toHaveBeenCalledWith(SESSION_ID_COOKIE_NAME, 'SID-1', COOKIE_OPTS);
  });

  it('si falla el registro del dispositivo, el login igual funciona (solo sin sid)', async () => {
    const { ctrl, sessionsService, res, req } = make();
    sessionsService.register.mockRejectedValue(new Error('db'));
    expect(await ctrl.createSession('ID-TOKEN', req as never, res as never)).toEqual({ ok: true });
    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, 'SESSION-COOKIE', COOKIE_OPTS);
  });

  it('si register no devuelve sid, no setea la cookie __sid', async () => {
    const { ctrl, sessionsService, res, req } = make();
    sessionsService.register.mockResolvedValue(null);
    await ctrl.createSession('ID-TOKEN', req as never, res as never);
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });
});

describe('POST /auth/session: dispositivo cerrado desde «Dispositivos» (ADR-020)', () => {
  it('rechaza (401) re-crear la cookie con el MISMO login que se cerró, y limpia las cookies', async () => {
    const { ctrl, sessionService, sessionsService, res, req } = make();
    sessionService.verifySessionCookie.mockResolvedValue({ uid: 'uid-1', auth_time: 1000 });
    sessionsService.wasRevokedAfterLogin.mockResolvedValue(true);
    await expect(ctrl.createSession('ID-TOKEN', req as never, res as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionsService.wasRevokedAfterLogin).toHaveBeenCalledWith('SID-OLD', 'uid-1', 1000);
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, '', CLEAR_OPTS);
    expect(res.cookie).toHaveBeenCalledWith(SESSION_ID_COOKIE_NAME, '', CLEAR_OPTS);
    expect(res.cookie).not.toHaveBeenCalledWith(SESSION_COOKIE_NAME, 'SESSION-COOKIE', expect.anything());
    expect(sessionsService.register).not.toHaveBeenCalled();
  });

  it('un login normal (no revocado) crea la cookie como siempre', async () => {
    const { ctrl, sessionService, res, req } = make();
    sessionService.verifySessionCookie.mockResolvedValue({ uid: 'uid-1', auth_time: Math.floor(Date.now() / 1000) });
    await expect(ctrl.createSession('ID-TOKEN', req as never, res as never)).resolves.toEqual({ ok: true });
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, 'SESSION-COOKIE', COOKIE_OPTS);
  });
});

describe('DELETE /auth/session (cerrar sesión)', () => {
  it('revoca en Firebase y en la base, y limpia AMBAS cookies', async () => {
    const { ctrl, sessionService, sessionsService, res } = make();
    expect(await ctrl.deleteSession({ uid: 'uid-1' } as never, res as never)).toEqual({ ok: true });
    expect(sessionService.revokeSession).toHaveBeenCalledWith('uid-1');
    expect(sessionsService.revokeAll).toHaveBeenCalledWith('uid-1');
    expect(res.cookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, '', CLEAR_OPTS);
    expect(res.cookie).toHaveBeenCalledWith(SESSION_ID_COOKIE_NAME, '', CLEAR_OPTS);
  });

  it('si revokeAll falla igual se cierra la sesión y se limpian las cookies', async () => {
    const { ctrl, sessionsService, res } = make();
    sessionsService.revokeAll.mockRejectedValue(new Error('db'));
    await expect(ctrl.deleteSession({ uid: 'uid-1' } as never, res as never)).resolves.toEqual({ ok: true });
    expect(res.cookie).toHaveBeenCalledTimes(2);
  });
});
