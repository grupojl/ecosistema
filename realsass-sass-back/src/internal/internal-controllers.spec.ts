import { InternalApiKeyGuard } from './internal-api-key.guard';
import { InternalAccessController } from './internal-access.controller';
import { InternalSessionsController } from './internal-sessions.controller';

/** Los endpoints /internal/* los protege la clave de servicio (el guard de Firebase no aplica): que NADA quede sin ella. */
const guardsOf = (c: object) => (Reflect.getMetadata('__guards__', c) ?? []) as unknown[];

describe('controllers internos (servicio a servicio)', () => {
  it.each([
    ['InternalAccessController', InternalAccessController],
    ['InternalSessionsController', InternalSessionsController],
  ])('%s exige InternalApiKeyGuard', (_name, controller) => {
    expect(guardsOf(controller)).toContain(InternalApiKeyGuard);
  });

  it('access consulta el acceso del uid a la organización', async () => {
    const users = { getOrganizationAccess: jest.fn().mockResolvedValue({ canAccess: true, role: 'OWNER' }) };
    const out = await new InternalAccessController(users as never).access('org-1', 'uid-1');
    expect(out).toEqual({ canAccess: true, role: 'OWNER' });
    expect(users.getOrganizationAccess).toHaveBeenCalledWith('uid-1', 'org-1');
  });

  it('sessions/:sid/revoked devuelve si está revocada (uid vacío si no viene)', async () => {
    const sessions = { isRevoked: jest.fn().mockResolvedValue(true) };
    const ctrl = new InternalSessionsController(sessions as never);
    expect(await ctrl.revoked('sid-1', 'uid-1')).toEqual({ revoked: true });
    await ctrl.revoked('sid-1', undefined as never);
    expect(sessions.isRevoked).toHaveBeenLastCalledWith('sid-1', '');
  });
});
