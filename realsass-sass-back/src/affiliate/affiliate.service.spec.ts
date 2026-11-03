import { NotFoundException } from '@nestjs/common';
import { AffiliatesService } from './affiliate.service';

const make = () => {
  const repo = {
    findProfileByFirebaseUid: jest.fn(),
    findReferralsByCode: jest.fn(),
    findByCode: jest.fn(),
    incrementReferralCount: jest.fn(),
    ensureProfile: jest.fn(),
    setReferredBy: jest.fn(),
  };
  return { svc: new AffiliatesService(repo as never), repo };
};

describe('AffiliatesService', () => {
  it('getMyProfile: devuelve el perfil o 404', async () => {
    const { svc, repo } = make();
    repo.findProfileByFirebaseUid.mockResolvedValueOnce(null).mockResolvedValueOnce({ referralCode: 'ref-1' });
    await expect(svc.getMyProfile('uid')).rejects.toBeInstanceOf(NotFoundException);
    expect(await svc.getMyProfile('uid')).toEqual({ referralCode: 'ref-1' });
  });

  it('getMyReferrals: lista los referidos por el código del propio usuario', async () => {
    const { svc, repo } = make();
    repo.findProfileByFirebaseUid.mockResolvedValue({ referralCode: 'ref-1' });
    repo.findReferralsByCode.mockResolvedValue([{ id: 'r' }]);
    expect(await svc.getMyReferrals('uid')).toEqual([{ id: 'r' }]);
    expect(repo.findReferralsByCode).toHaveBeenCalledWith('ref-1');
  });

  it('getMyReferrals: 404 sin perfil y no consulta referidos', async () => {
    const { svc, repo } = make();
    repo.findProfileByFirebaseUid.mockResolvedValue(null);
    await expect(svc.getMyReferrals('uid')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findReferralsByCode).not.toHaveBeenCalled();
  });

  it('ensureProfile delega en el repositorio (idempotente)', async () => {
    const { svc, repo } = make();
    repo.ensureProfile.mockResolvedValue({ id: 'p' });
    expect(await svc.ensureProfile('u1', 'ref-1')).toEqual({ id: 'p' });
    expect(repo.ensureProfile).toHaveBeenCalledWith('u1', 'ref-1');
  });

  describe('registerReferral', () => {
    it('suma un referido al dueño del código', async () => {
      const { svc, repo } = make();
      repo.findByCode.mockResolvedValue({ userId: 'owner' });
      await svc.registerReferral('ref-1', 'nuevo');
      expect(repo.incrementReferralCount).toHaveBeenCalledWith('owner');
      expect(repo.setReferredBy).toHaveBeenCalledWith('nuevo', 'ref-1'); // queda asentado quién lo refirió
    });

    it('un código inexistente se ignora sin error', async () => {
      const { svc, repo } = make();
      repo.findByCode.mockResolvedValue(null);
      await expect(svc.registerReferral('malo', 'nuevo')).resolves.toBeUndefined();
      expect(repo.incrementReferralCount).not.toHaveBeenCalled();
      expect(repo.setReferredBy).not.toHaveBeenCalled();
    });

    it('no permite auto-referirse', async () => {
      const { svc, repo } = make();
      repo.findByCode.mockResolvedValue({ userId: 'yo' });
      await svc.registerReferral('mi-codigo', 'yo');
      expect(repo.incrementReferralCount).not.toHaveBeenCalled();
    });

    it('si falla el contador no rompe el alta del usuario', async () => {
      const { svc, repo } = make();
      repo.findByCode.mockResolvedValue({ userId: 'owner' });
      repo.incrementReferralCount.mockRejectedValue(new Error('db'));
      await expect(svc.registerReferral('ref-1', 'nuevo')).resolves.toBeUndefined();
    });
  });
});
