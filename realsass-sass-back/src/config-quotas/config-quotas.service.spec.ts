import { ConfigQuotasService } from './config-quotas.service';
import { QuotaExceededException } from '@/common/exceptions/quota-exceeded.exception';

const make = () => {
  const repo = { findAllByOrg: jest.fn(), findByResource: jest.fn(), increment: jest.fn(), updateLimit: jest.fn() };
  const audit = { log: jest.fn() };
  const svc = new ConfigQuotasService(repo as never, {} as never, audit as never, { emit: jest.fn() } as never);
  return { svc, repo, audit };
};

describe('ConfigQuotasService', () => {
  it('sin quota configurada no hay límite', async () => {
    const { svc, repo } = make();
    repo.findByResource.mockResolvedValue(null);
    await expect(svc.check('o', 'products')).resolves.toBeUndefined();
  });

  it('limit null = ilimitado', async () => {
    const { svc, repo } = make();
    repo.findByResource.mockResolvedValue({ limit: null, currentUsage: 999 });
    await expect(svc.check('o', 'products')).resolves.toBeUndefined();
  });

  it('lanza QuotaExceededException al alcanzar el límite', async () => {
    const { svc, repo } = make();
    repo.findByResource.mockResolvedValue({ limit: 5, currentUsage: 5 });
    await expect(svc.check('o', 'products')).rejects.toBeInstanceOf(QuotaExceededException);
  });

  it('increment chequea antes de sumar y no suma si excede', async () => {
    const { svc, repo } = make();
    repo.findByResource.mockResolvedValue({ limit: 1, currentUsage: 1 });
    await expect(svc.increment('o', 'products')).rejects.toBeInstanceOf(QuotaExceededException);
    expect(repo.increment).not.toHaveBeenCalled();
  });

  it('increment suma el delta cuando hay cupo', async () => {
    const { svc, repo } = make();
    repo.findByResource.mockResolvedValue({ limit: 10, currentUsage: 1 });
    await svc.increment('o', 'products', 3);
    expect(repo.increment).toHaveBeenCalledWith('o', 'products', 3);
  });

  it('updateLimit audita el valor anterior (none si no había)', async () => {
    const { svc, repo, audit } = make();
    repo.findByResource.mockResolvedValueOnce(null).mockResolvedValueOnce({ limit: 5 });
    repo.updateLimit.mockResolvedValue({});
    await svc.updateLimit('o', 'u', 'products', 10);
    await svc.updateLimit('o', 'u', 'products', 20);
    expect(audit.log).toHaveBeenNthCalledWith(1, expect.objectContaining({ previousValue: 'none', newValue: '10' }));
    expect(audit.log).toHaveBeenNthCalledWith(2, expect.objectContaining({ previousValue: '5', newValue: '20' }));
  });

  it('getForOrg lista las quotas de la organización', async () => {
    const { svc, repo } = make();
    repo.findAllByOrg.mockResolvedValue([1]);
    expect(await svc.getForOrg('o')).toEqual([1]);
  });
});
