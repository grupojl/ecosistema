import { NotFoundException } from '@nestjs/common';
import { UsersService } from '@/users/users.service';
import type { IUsersRepository } from '@/users/repository/users.repository.interface';

describe('UsersService', () => {
  const repo = { buildProfile: jest.fn(), getOrganizationAccess: jest.fn() };
  const service = new UsersService(repo as unknown as IUsersRepository);

  const profile = { user: { id: 'u1' }, organization: { id: 'org-1' }, organizations: [], collaborations: [{ organizationId: 'org-2' }] };

  beforeEach(() => jest.clearAllMocks());

  it('buildProfile y getMyProfile devuelven el perfil, o NotFound si el usuario no existe', async () => {
    repo.buildProfile.mockResolvedValueOnce(profile);
    await expect(service.buildProfile('uid')).resolves.toBe(profile);

    repo.buildProfile.mockResolvedValueOnce(null);
    await expect(service.getMyProfile('uid')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getDashboardAccess expone solo organización y colaboraciones (nada más del perfil)', async () => {
    repo.buildProfile.mockResolvedValue(profile);

    await expect(service.getDashboardAccess('uid')).resolves.toEqual({ organization: profile.organization, collaborations: profile.collaborations });
  });

  it('getDashboardAccess y selectRole sobre un usuario inexistente => NotFound', async () => {
    repo.buildProfile.mockResolvedValue(null);

    await expect(service.getDashboardAccess('uid')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.selectRole('uid', { role: 'owner' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('selectRole confirma el rol para un usuario existente', async () => {
    repo.buildProfile.mockResolvedValue(profile);

    await expect(service.selectRole('uid', { role: 'affiliate' })).resolves.toEqual({ ok: true, role: 'affiliate' });
  });

  it('getOrganizationAccess delega con el uid y la organización pedidos', async () => {
    repo.getOrganizationAccess.mockResolvedValue({ hasAccess: true });

    await service.getOrganizationAccess('uid', 'org-1');

    expect(repo.getOrganizationAccess).toHaveBeenCalledWith('uid', 'org-1');
  });
});
