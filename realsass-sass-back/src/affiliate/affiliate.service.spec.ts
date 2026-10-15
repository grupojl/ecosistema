import { NotFoundException } from '@nestjs/common';
import { AffiliatesService } from '@/affiliate/affiliate.service';
import type { IAffiliateRepository } from '@/affiliate/repository/affiliate.repository.interface';

describe('AffiliatesService', () => {
  const repo = { findProfileByFirebaseUid: jest.fn(), findReferralsByCode: jest.fn(), findByCode: jest.fn(), incrementReferralCount: jest.fn() };
  const service = new AffiliatesService(repo as unknown as IAffiliateRepository);

  beforeEach(() => jest.clearAllMocks());

  describe('perfil y referidos', () => {
    it('sin perfil de afiliado => NotFound (perfil y referidos)', async () => {
      repo.findProfileByFirebaseUid.mockResolvedValue(null);

      await expect(service.getMyProfile('uid')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getMyReferrals('uid')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findReferralsByCode).not.toHaveBeenCalled();
    });

    it('los referidos se buscan por el código del propio perfil, nunca por uno recibido', async () => {
      repo.findProfileByFirebaseUid.mockResolvedValue({ referralCode: 'MIO' });
      repo.findReferralsByCode.mockResolvedValue([{ id: 'r1' }]);

      await expect(service.getMyReferrals('uid')).resolves.toEqual([{ id: 'r1' }]);
      expect(repo.findReferralsByCode).toHaveBeenCalledWith('MIO');
    });
  });

  describe('registerReferral', () => {
    it('un código inexistente se ignora sin lanzar', async () => {
      repo.findByCode.mockResolvedValue(null);

      await expect(service.registerReferral('NOPE', 'u-new')).resolves.toBeUndefined();
      expect(repo.incrementReferralCount).not.toHaveBeenCalled();
    });

    it('no hay auto-referidos', async () => {
      repo.findByCode.mockResolvedValue({ userId: 'u-1' });

      await service.registerReferral('MIO', 'u-1');

      expect(repo.incrementReferralCount).not.toHaveBeenCalled();
    });

    it('suma un referido al dueño del código', async () => {
      repo.findByCode.mockResolvedValue({ userId: 'u-afiliado' });

      await service.registerReferral('COD', 'u-nuevo');

      expect(repo.incrementReferralCount).toHaveBeenCalledWith('u-afiliado');
    });

    it('si el conteo falla NO rompe el alta del usuario nuevo', async () => {
      repo.findByCode.mockResolvedValue({ userId: 'u-afiliado' });
      repo.incrementReferralCount.mockRejectedValue(new Error('db caída'));

      await expect(service.registerReferral('COD', 'u-nuevo')).resolves.toBeUndefined();
    });
  });
});
