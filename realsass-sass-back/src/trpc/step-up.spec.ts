import { TRPCError } from '@trpc/server';
import { getAuth } from 'firebase-admin/auth';
import { SESSION_COOKIE_NAME } from '@real/auth-server';
import { enforceStepUp } from './step-up';

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

const verifyIdToken = jest.fn();
const verifySessionCookie = jest.fn();
const nowSec = () => Math.floor(Date.now() / 1000);
const req = (over: Record<string, unknown>) => over as never;

describe('enforceStepUp', () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    verifySessionCookie.mockReset();
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken, verifySessionCookie });
  });

  it('pasa con un Bearer cuyo auth_time es reciente', async () => {
    verifyIdToken.mockResolvedValue({ auth_time: nowSec() - 30 });
    await expect(enforceStepUp(req({ headers: { authorization: 'Bearer tok' } }))).resolves.toBeUndefined();
    expect(verifyIdToken).toHaveBeenCalledWith('tok');
  });

  it('pasa con la cookie de sesión reciente (verificada con revocación)', async () => {
    verifySessionCookie.mockResolvedValue({ auth_time: nowSec() - 10 });
    await enforceStepUp(req({ headers: {}, cookies: { [SESSION_COOKIE_NAME]: 'cook' } }));
    expect(verifySessionCookie).toHaveBeenCalledWith('cook', true);
  });

  it('pide re-autenticación (FORBIDDEN) si pasaron más de 5 minutos', async () => {
    verifyIdToken.mockResolvedValue({ auth_time: nowSec() - 6 * 60 });
    const err = await enforceStepUp(req({ headers: { authorization: 'Bearer tok' } })).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.cause).toBeDefined();
  });

  it('UNAUTHORIZED si no hay ni Bearer ni cookie', async () => {
    await expect(enforceStepUp(req({ headers: {} }))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('UNAUTHORIZED si Firebase rechaza el token', async () => {
    verifyIdToken.mockRejectedValue(new Error('expired'));
    await expect(enforceStepUp(req({ headers: { authorization: 'Bearer x' } }))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
