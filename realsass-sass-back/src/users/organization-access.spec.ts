import { PrismaUsersRepository } from '@/users/repository/prisma-users.repository';

/**
 * Quién puede entrar a una organización (D4: se valida contra la base en cada request, no contra la cookie).
 * Una sola consulta trae la organización propia y la colaboración ACTIVA del usuario.
 */
describe('PrismaUsersRepository.getOrganizationAccess', () => {
  let findUnique: jest.Mock;
  let repo: PrismaUsersRepository;

  beforeEach(() => {
    findUnique = jest.fn();
    repo = new PrismaUsersRepository({ user: { findUnique } } as never);
  });

  const userRow = (over: Record<string, unknown> = {}) => ({
    id: 'user-1', organizations: [], collaborations: [], ...over,
  });

  it('usuario inexistente → sin acceso', async () => {
    findUnique.mockResolvedValue(null);
    await expect(repo.getOrganizationAccess('uid-x', 'org-1')).resolves.toEqual({ canAccess: false, reason: 'User not found' });
  });

  it('dueño de la organización → OWNER con todos los permisos', async () => {
    findUnique.mockResolvedValue(userRow({ organizations: [{ id: 'org-1' }] }));
    const res = await repo.getOrganizationAccess('uid-x', 'org-1');
    expect(res).toMatchObject({ canAccess: true, userId: 'user-1', organizationId: 'org-1', role: 'OWNER' });
    const perms = Object.values(res.permissions ?? {});
    expect(perms.length).toBeGreaterThan(0);
    expect(perms.every((v) => v === true)).toBe(true);
  });

  it('colaborador activo → MEMBER con los permisos que se le dieron sobre los de por defecto', async () => {
    findUnique.mockResolvedValue(userRow({ collaborations: [{ permissions: { permisoNuevo: true } }] }));
    const res = await repo.getOrganizationAccess('uid-x', 'org-1');
    expect(res).toMatchObject({ canAccess: true, role: 'MEMBER', organizationId: 'org-1' });
    expect(res.permissions?.permisoNuevo).toBe(true);
    // un colaborador NO recibe todos los permisos como el dueño
    expect(Object.values(res.permissions ?? {}).every((v) => v === true)).toBe(false);
  });

  it('ni dueño ni colaborador activo → sin acceso', async () => {
    findUnique.mockResolvedValue(userRow());
    await expect(repo.getOrganizationAccess('uid-x', 'org-1')).resolves.toEqual({ canAccess: false, reason: 'No access' });
  });

  it('la consulta filtra por ESTA organización y solo colaboraciones ACTIVAS (una pausada o de otra org no entra)', async () => {
    findUnique.mockResolvedValue(userRow());
    await repo.getOrganizationAccess('uid-x', 'org-7');
    expect(findUnique).toHaveBeenCalledWith({
      where: { firebaseUid: 'uid-x' },
      include: {
        organizations:  { where: { id: 'org-7' }, select: { id: true } },
        collaborations: { where: { organizationId: 'org-7', status: 'ACTIVE' } },
      },
    });
  });

  it('ser dueño gana sobre ser colaborador', async () => {
    findUnique.mockResolvedValue(userRow({ organizations: [{ id: 'org-1' }], collaborations: [{ permissions: {} }] }));
    await expect(repo.getOrganizationAccess('uid-x', 'org-1')).resolves.toMatchObject({ role: 'OWNER' });
  });
});
