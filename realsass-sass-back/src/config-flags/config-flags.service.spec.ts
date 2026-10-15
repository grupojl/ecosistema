import { NotFoundException } from '@nestjs/common';
import { ConfigFlagsService } from '@/config-flags/config-flags.service';
import type { IFeatureFlagsRepository } from '@/config-flags/repository/feature-flags.repository.interface';
import type { ConfigCacheService } from '@/config-cache/config-cache.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';
import type { EventEmitter2 } from '@nestjs/event-emitter';

describe('ConfigFlagsService', () => {
  const repo = { findAllByOrg: jest.fn(), findById: jest.fn(), update: jest.fn() };
  const audit = { log: jest.fn() };
  const events = { emit: jest.fn() };
  const service = new ConfigFlagsService(
    repo as unknown as IFeatureFlagsRepository,
    {} as unknown as ConfigCacheService,
    audit as unknown as ConfigAuditService,
    events as unknown as EventEmitter2,
  );

  beforeEach(() => jest.clearAllMocks());

  it('list devuelve todos los flags de la organización y los globales', async () => {
    repo.findAllByOrg.mockResolvedValue([{ key: 'a', enabled: false }, { key: 'b', enabled: true }]);

    await expect(service.list('org-1')).resolves.toHaveLength(2);
    expect(repo.findAllByOrg).toHaveBeenCalledWith('org-1');
  });

  it('getForOrg devuelve solo los habilitados', async () => {
    repo.findAllByOrg.mockResolvedValue([{ key: 'a', enabled: false }, { key: 'b', enabled: true }]);

    await expect(service.getForOrg('org-1')).resolves.toEqual([{ key: 'b', enabled: true }]);
  });

  describe('update', () => {
    it.each([
      ['inexistente', null],
      ['de otra organización', { id: 'f-1', organizationId: 'org-2', key: 'x', enabled: false }],
      ['global (organizationId null)', { id: 'f-1', organizationId: null, key: 'x', enabled: false }],
    ])('un flag %s => NotFound y nada cambia', async (_label, found) => {
      repo.findById.mockResolvedValue(found);

      await expect(service.update('org-1', 'u1', 'f-1', { enabled: true })).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('actualiza un flag propio, audita antes/después y emite el evento', async () => {
      repo.findById.mockResolvedValue({ id: 'f-1', organizationId: 'org-1', key: 'beta', enabled: false });
      repo.update.mockResolvedValue({ id: 'f-1', organizationId: 'org-1', key: 'beta', enabled: true });

      const out = await service.update('org-1', 'u1', 'f-1', { enabled: true });

      expect(out.enabled).toBe(true);
      expect(repo.update).toHaveBeenCalledWith('f-1', { enabled: true });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: 'org-1', userId: 'u1', configKey: 'beta', action: 'update',
        previousValue: JSON.stringify({ enabled: false }), newValue: JSON.stringify({ enabled: true }),
      }));
      expect(events.emit).toHaveBeenCalledWith('config.flag.updated', { organizationId: 'org-1', flag: out });
    });
  });
});
