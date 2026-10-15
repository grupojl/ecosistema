import type { Request } from 'express';
import { enforceStepUp } from '@/trpc/step-up';
import { AppCodeError } from '@/trpc/app-code-error';

const admin = { verifyIdToken: jest.fn(), verifySessionCookie: jest.fn() };
jest.mock('@real/auth-server', () => ({ getFirebaseAdmin: () => admin, SESSION_COOKIE_NAME: 'session' }));

const MIN = 60 * 1000;
const nowSec = () => Math.floor(Date.now() / 1000);

const req = (parts: { authorization?: string; cookie?: string }) =>
  ({ headers: parts.authorization ? { authorization: parts.authorization } : {}, cookies: parts.cookie ? { session: parts.cookie } : undefined }) as unknown as Request;

describe('enforceStepUp (re-autenticación reciente para secretos y webhooks)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sin Bearer ni cookie => UNAUTHORIZED', async () => {
    await expect(enforceStepUp(req({}))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(admin.verifyIdToken).not.toHaveBeenCalled();
  });

  it('un token que Firebase rechaza => UNAUTHORIZED (no se interpreta como "reciente")', async () => {
    admin.verifyIdToken.mockRejectedValue(new Error('expired'));

    await expect(enforceStepUp(req({ authorization: 'Bearer malo' }))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('una cookie revocada => UNAUTHORIZED (se verifica con checkRevoked=true)', async () => {
    admin.verifySessionCookie.mockRejectedValue(new Error('revoked'));

    await expect(enforceStepUp(req({ cookie: 'c' }))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(admin.verifySessionCookie).toHaveBeenCalledWith('c', true);
  });

  it('un Authorization que no es "Bearer ..." se ignora', async () => {
    await expect(enforceStepUp(req({ authorization: 'Basic abc' }))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('auth_time dentro de 5 minutos => pasa (Bearer)', async () => {
    admin.verifyIdToken.mockResolvedValue({ auth_time: nowSec() - 4 * 60 });

    await expect(enforceStepUp(req({ authorization: 'Bearer ok' }))).resolves.toBeUndefined();
  });

  it('auth_time dentro de 5 minutos => pasa (cookie de sesión)', async () => {
    admin.verifySessionCookie.mockResolvedValue({ auth_time: nowSec() - 60 });

    await expect(enforceStepUp(req({ cookie: 'c' }))).resolves.toBeUndefined();
  });

  it('auth_time viejo => FORBIDDEN con appCode REAUTH_REQUIRED (la UI reautentica y reintenta)', async () => {
    admin.verifyIdToken.mockResolvedValue({ auth_time: nowSec() - 6 * 60 });

    const error = await enforceStepUp(req({ authorization: 'Bearer ok' })).catch((e: unknown) => e) as { code: string; cause: unknown };

    expect(error.code).toBe('FORBIDDEN');
    expect(error.cause).toBeInstanceOf(AppCodeError);
    expect((error.cause as AppCodeError).appCode).toBe('REAUTH_REQUIRED');
  });

  it('una sesión vieja con cookie renovada sigue pidiendo re-login: manda el auth_time del login real', async () => {
    admin.verifySessionCookie.mockResolvedValue({ auth_time: nowSec() - 3 * 60 * 60 });

    await expect(enforceStepUp(req({ cookie: 'renovada' }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('el límite es de 5 minutos: 4:59 pasa, 5:01 no', async () => {
    admin.verifyIdToken.mockResolvedValueOnce({ auth_time: nowSec() - (5 * 60 - 1) });
    await expect(enforceStepUp(req({ authorization: 'Bearer ok' }))).resolves.toBeUndefined();

    admin.verifyIdToken.mockResolvedValueOnce({ auth_time: nowSec() - (5 * 60 + 1) });
    await expect(enforceStepUp(req({ authorization: 'Bearer ok' }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(5 * MIN).toBe(300_000);
  });
});
