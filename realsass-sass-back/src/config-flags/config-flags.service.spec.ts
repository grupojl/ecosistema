import { NotFoundException } from '@nestjs/common';
import { ConfigFlagsService } from './config-flags.service';

const make = () => {
  const repo = { findAllByOrg: jest.fn(), findById: jest.fn(), update: jest.fn() };
  const audit = { log: jest.fn() };
  const events = { emit: jest.fn() };
  const svc = new ConfigFlagsService(repo as never, {} as never, audit as never, events as never);
  return { svc, repo, audit, events };
};

describe('ConfigFlagsService', () => {
  it('getForOrg devuelve solo los flags habilitados', async () => {
    const { svc, repo } = make();
    repo.findAllByOrg.mockResolvedValue([{ key: 'a', enabled: true }, { key: 'b', enabled: false }]);
    expect(await svc.getForOrg('org-1')).toEqual([{ key: 'a', enabled: true }]);
  });

  it('list devuelve todos los de la organización', async () => {
    const { svc, repo } = make();
    repo.findAllByOrg.mockResolvedValue([1, 2]);
    expect(await svc.list('org-1')).toEqual([1, 2]);
    expect(repo.findAllByOrg).toHaveBeenCalledWith('org-1');
  });

  it('update actualiza, audita y emite el evento', async () => {
    const { svc, repo, audit, events } = make();
    repo.findById.mockResolvedValue({ id: 'f', key: 'k', enabled: false, organizationId: 'org-1' });
    repo.update.mockResolvedValue({ id: 'f', enabled: true });
    const out = await svc.update('org-1', 'u1', 'f', { enabled: true } as never);
    expect(out).toEqual({ id: 'f', enabled: true });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', configKey: 'k', action: 'update' }),
    );
    expect(events.emit).toHaveBeenCalledWith('config.flag.updated', { organizationId: 'org-1', flag: out });
  });

  it.each([
    ['no existe', null],
    ['es global (organizationId null)', { id: 'f', organizationId: null }],
    ['es de otra organización', { id: 'f', organizationId: 'org-2' }],
  ])('update rechaza (404) un flag que %s y no escribe nada', async (_n, flag) => {
    const { svc, repo, audit } = make();
    repo.findById.mockResolvedValue(flag);
    await expect(svc.update('org-1', 'u1', 'f', {} as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
