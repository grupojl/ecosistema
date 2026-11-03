import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

const make = () => {
  const repo = { buildProfile: jest.fn(), getOrganizationAccess: jest.fn(), upsert: jest.fn() };
  return { svc: new UsersService(repo as never), repo };
};

describe('UsersService', () => {
  it('buildProfile / getMyProfile: perfil o 404', async () => {
    const { svc, repo } = make();
    repo.buildProfile.mockResolvedValueOnce(null).mockResolvedValue({ user: { id: 'u' } });
    await expect(svc.buildProfile('uid')).rejects.toBeInstanceOf(NotFoundException);
    expect(await svc.getMyProfile('uid')).toEqual({ user: { id: 'u' } });
  });

  it('getDashboardAccess expone solo la organización y las colaboraciones', async () => {
    const { svc, repo } = make();
    repo.buildProfile.mockResolvedValue({
      user: { id: 'u', email: 'privado@x.com' },
      organization: { id: 'o' },
      collaborations: [{ organizationId: 'o2' }],
    });
    expect(await svc.getDashboardAccess('uid')).toEqual({ organization: { id: 'o' }, collaborations: [{ organizationId: 'o2' }] });
  });

  it('getDashboardAccess y selectRole: 404 si el usuario no existe', async () => {
    const { svc, repo } = make();
    repo.buildProfile.mockResolvedValue(null);
    await expect(svc.getDashboardAccess('uid')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.selectRole('uid', { role: 'owner' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('selectRole confirma el rol elegido', async () => {
    const { svc, repo } = make();
    repo.buildProfile.mockResolvedValue({ user: {} });
    expect(await svc.selectRole('uid', { role: 'affiliate' })).toEqual({ ok: true, role: 'affiliate' });
  });

  it('getOrganizationAccess delega por uid y organización', async () => {
    const { svc, repo } = make();
    repo.getOrganizationAccess.mockResolvedValue({ role: 'OWNER' });
    expect(await svc.getOrganizationAccess('uid', 'org')).toEqual({ role: 'OWNER' });
    expect(repo.getOrganizationAccess).toHaveBeenCalledWith('uid', 'org');
  });

  it('upsertUser arma el input del repositorio y respeta la transacción', async () => {
    const { svc, repo } = make();
    const tx = {} as never;
    await svc.upsertUser('uid', 'a@b.com', 'Ana', 'http://f', 'ref-1', tx);
    expect(repo.upsert).toHaveBeenCalledWith(
      { firebaseUid: 'uid', email: 'a@b.com', displayName: 'Ana', photoUrl: 'http://f', referredByCode: 'ref-1' },
      tx,
    );
  });
});
