import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { StepUpGuard } from '@/common/guards/step-up.guard';

const admin = { verifyIdToken: jest.fn() };
jest.mock('@real/auth-server', () => ({ getFirebaseAdmin: () => admin }));

const ctx = (authorization?: string) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers: authorization ? { authorization } : {} }) }) }) as unknown as ExecutionContext;
const nowSec = () => Math.floor(Date.now() / 1000);

describe('StepUpGuard', () => {
  const guard = new StepUpGuard();

  beforeEach(() => jest.clearAllMocks());

  it('sin token => 403 y no consulta a Firebase', async () => {
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(ForbiddenException);
    expect(admin.verifyIdToken).not.toHaveBeenCalled();
  });

  it('auth_time reciente => pasa', async () => {
    admin.verifyIdToken.mockResolvedValue({ auth_time: nowSec() - 60 });

    await expect(guard.canActivate(ctx('Bearer t'))).resolves.toBe(true);
  });

  it('auth_time de hace más de 5 minutos => 403 pidiendo re-autenticación', async () => {
    admin.verifyIdToken.mockResolvedValue({ auth_time: nowSec() - 10 * 60 });

    await expect(guard.canActivate(ctx('Bearer t'))).rejects.toThrow(/Re-autenticacion requerida/);
  });

  it('un token inválido propaga el error de Firebase (no pasa)', async () => {
    admin.verifyIdToken.mockRejectedValue(new Error('invalid'));

    await expect(guard.canActivate(ctx('Bearer t'))).rejects.toThrow('invalid');
  });
});
