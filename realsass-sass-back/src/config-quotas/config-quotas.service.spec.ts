import { ConfigQuotasService } from '@/config-quotas/config-quotas.service';
import { QuotaExceededException } from '@/common/exceptions/quota-exceeded.exception';
import type { IQuotasRepository } from '@/config-quotas/repository/quotas.repository.interface';
import type { ConfigCacheService } from '@/config-cache/config-cache.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';
import type { EventEmitter2 } from '@nestjs/event-emitter';

describe('ConfigQuotasService', () => {
  const repo = { findAllByOrg: jest.fn(), findByResource: jest.fn(), increment: jest.fn(), updateLimit: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new ConfigQuotasService(
    repo as unknown as IQuotasRepository,
    {} as unknown as ConfigCacheService,
    audit as unknown as ConfigAuditService,
    {} as unknown as EventEmitter2,
  );

  beforeEach(() => jest.clearAllMocks());

  it('getForOrg consulta solo la organización pedida', async () => {
    await service.getForOrg('org-1');

    expect(repo.findAllByOrg).toHaveBeenCalledWith('org-1');
  });

  describe('check', () => {
    it('sin quota configurada = sin límite', async () => {
      repo.findByResource.mockResolvedValue(null);

      await expect(service.check('org-1', 'products')).resolves.toBeUndefined();
    });

    it('quota sin límite (null) no bloquea', async () => {
      repo.findByResource.mockResolvedValue({ limit: null, currentUsage: 9999 });

      await expect(service.check('org-1', 'products')).resolves.toBeUndefined();
    });

    it('bajo el límite pasa; en el límite (usage >= limit) lanza 429', async () => {
      repo.findByResource.mockResolvedValueOnce({ limit: 10, currentUsage: 9 });
      await expect(service.check('org-1', 'products')).resolves.toBeUndefined();

      repo.findByResource.mockResolvedValueOnce({ limit: 10, currentUsage: 10 });
      const err = await service.check('org-1', 'products').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(QuotaExceededException);
      expect((err as QuotaExceededException).getStatus()).toBe(429);
    });
  });

  describe('increment', () => {
    it('no incrementa si la quota ya está agotada', async () => {
      repo.findByResource.mockResolvedValue({ limit: 1, currentUsage: 1 });

      await expect(service.increment('org-1', 'products')).rejects.toBeInstanceOf(QuotaExceededException);
      expect(repo.increment).not.toHaveBeenCalled();
    });

    it('incrementa en 1 por defecto y en el delta pedido', async () => {
      repo.findByResource.mockResolvedValue({ limit: 10, currentUsage: 0 });

      await service.increment('org-1', 'products');
      await service.increment('org-1', 'products', 3);

      expect(repo.increment).toHaveBeenNthCalledWith(1, 'org-1', 'products', 1);
      expect(repo.increment).toHaveBeenNthCalledWith(2, 'org-1', 'products', 3);
    });
  });

  describe('updateLimit', () => {
    it('audita el límite anterior y el nuevo', async () => {
      repo.findByResource.mockResolvedValue({ limit: 5 });
      repo.updateLimit.mockResolvedValue({ limit: 20 });

      await service.updateLimit('org-1', 'u1', 'products', 20);

      expect(repo.updateLimit).toHaveBeenCalledWith('org-1', 'products', 20);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ configKey: 'products', action: 'update_limit', previousValue: '5', newValue: '20' }));
    });

    it('sin quota previa audita "none"', async () => {
      repo.findByResource.mockResolvedValue(null);
      repo.updateLimit.mockResolvedValue({ limit: 20 });

      await service.updateLimit('org-1', 'u1', 'products', 20);

      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ previousValue: 'none' }));
    });
  });
});
