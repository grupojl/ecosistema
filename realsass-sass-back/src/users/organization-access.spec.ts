import { PrismaUsersRepository } from '@/users/repository/prisma-users.repository';
import type { PrismaService } from '@/prisma/prisma.service';

/**
 * Aislamiento de tenant: es la consulta que decide si un usuario puede operar una organización
 * (la usan sass-back y, vía /internal/access, ecommerce-back). Si falla acá, falla el multi-tenant.
 */
describe('PrismaUsersRepository.getOrganizationAccess (aislamiento de tenant)', () => {
  const findUnique = jest.fn();
  const repo = new PrismaUsersRepository({ user: { findUnique } } as unknown as PrismaService);

  beforeEach(() => findUnique.mockReset());

  it('usuario inexistente => sin acceso', async () => {
    findUnique.mockResolvedValue(null);

    expect(await repo.getOrganizationAccess('uid-x', 'org-1')).toEqual({ canAccess: false, reason: 'User not found' });
  });

  it('dueño de la organización => OWNER con todos los permisos', async () => {
    findUnique.mockResolvedValue({ id: 'user-1', organizations: [{ id: 'org-1' }], collaborations: [] });

    const result = await repo.getOrganizationAccess('uid-x', 'org-1');

    expect(result).toMatchObject({ canAccess: true, userId: 'user-1', organizationId: 'org-1', role: 'OWNER' });
    expect(Object.values(result.permissions ?? {}).every(Boolean)).toBe(true);
  });

  it('colaborador activo => MEMBER con los permisos por defecto + los suyos', async () => {
    findUnique.mockResolvedValue({
      id: 'user-2', organizations: [],
      collaborations: [{ permissions: { canEditListings: true } }],
    });

    const result = await repo.getOrganizationAccess('uid-y', 'org-1');

    expect(result).toMatchObject({ canAccess: true, userId: 'user-2', role: 'MEMBER' });
    expect(result.permissions).toMatchObject({ canViewListings: true, canEditListings: true, canDeleteListings: false });
  });

  it('ni dueño ni colaborador de ESA organización => sin acceso', async () => {
    findUnique.mockResolvedValue({ id: 'user-3', organizations: [], collaborations: [] });

    expect(await repo.getOrganizationAccess('uid-z', 'org-1')).toEqual({ canAccess: false, reason: 'No access' });
  });

  it('la consulta se acota SIEMPRE a la organización pedida y a colaboraciones ACTIVAS', async () => {
    findUnique.mockResolvedValue(null);

    await repo.getOrganizationAccess('uid-x', 'org-42');

    expect(findUnique).toHaveBeenCalledWith({
      where:   { firebaseUid: 'uid-x' },
      include: {
        organizations:  { where: { id: 'org-42' }, select: { id: true } },
        collaborations: { where: { organizationId: 'org-42', status: 'ACTIVE' } },
      },
    });
  });
});
