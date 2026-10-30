import { ForbiddenException, type ExecutionContext } from '@nestjs/common';

const verifyIdToken = jest.fn();
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken }) }));
jest.mock('firebase-admin', () => ({}));

import { StepUpGuard } from './step-up.guard';

function ctxWith(headers: Record<string, string>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as unknown as ExecutionContext;
}

const nowSec = () => Math.floor(Date.now() / 1000);

describe('StepUpGuard', () => {
  const guard = new StepUpGuard();

  beforeEach(() => verifyIdToken.mockReset());

  it('403 si no hay token', async () => {
    await expect(guard.canActivate(ctxWith({}))).rejects.toThrow(ForbiddenException);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('deja pasar si la autenticación es reciente (< 5 min)', async () => {
    verifyIdToken.mockResolvedValue({ auth_time: nowSec() - 60 });
    await expect(guard.canActivate(ctxWith({ authorization: 'Bearer tok' }))).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('tok');
  });

  it('exige re-autenticación si pasaron más de 5 minutos', async () => {
    verifyIdToken.mockResolvedValue({ auth_time: nowSec() - 6 * 60 });
    await expect(guard.canActivate(ctxWith({ authorization: 'Bearer tok' }))).rejects.toThrow('Re-autenticacion requerida');
  });

  it('el límite: 4 min 59 s pasa, 5 min 5 s no', async () => {
    verifyIdToken.mockResolvedValue({ auth_time: nowSec() - (5 * 60 - 1) });
    await expect(guard.canActivate(ctxWith({ authorization: 'Bearer tok' }))).resolves.toBe(true);
    verifyIdToken.mockResolvedValue({ auth_time: nowSec() - (5 * 60 + 5) });
    await expect(guard.canActivate(ctxWith({ authorization: 'Bearer tok' }))).rejects.toThrow(ForbiddenException);
  });

  it('propaga el error si el token es inválido (no deja pasar)', async () => {
    verifyIdToken.mockRejectedValue(new Error('token inválido'));
    await expect(guard.canActivate(ctxWith({ authorization: 'Bearer malo' }))).rejects.toThrow('token inválido');
  });
});
