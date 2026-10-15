import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigThemesService } from '@/config-themes/config-themes.service';
import type { IThemesRepository } from '@/config-themes/repository/themes.repository.interface';
import type { ConfigCacheService } from '@/config-cache/config-cache.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';
import type { EventEmitter2 } from '@nestjs/event-emitter';

describe('ConfigThemesService', () => {
  const repo = { findAllByOrg: jest.fn(), findById: jest.fn(), findActive: jest.fn(), findPublicByOrgId: jest.fn(), create: jest.fn(), activate: jest.fn(), remove: jest.fn() };
  const audit = { log: jest.fn() };
  const events = { emit: jest.fn() };
  const service = new ConfigThemesService(
    repo as unknown as IThemesRepository,
    {} as unknown as ConfigCacheService,
    audit as unknown as ConfigAuditService,
    events as unknown as EventEmitter2,
  );

  const theme = (over: Record<string, unknown> = {}) => ({ id: 't-1', organizationId: 'org-1', isActive: false, isSystemDefault: false, ...over });

  beforeEach(() => jest.clearAllMocks());

  it('getPublicTheme y list consultan solo la organización pedida', async () => {
    await service.getPublicTheme('org-1');
    await service.list('org-1');

    expect(repo.findPublicByOrgId).toHaveBeenCalledWith('org-1');
    expect(repo.findAllByOrg).toHaveBeenCalledWith('org-1');
  });

  it('create fuerza organizationId desde el contexto y audita', async () => {
    repo.create.mockResolvedValue({ id: 't-1', name: 'Oscuro' });

    await service.create('org-1', 'u1', { name: 'Oscuro' });

    expect(repo.create).toHaveBeenCalledWith({ name: 'Oscuro', organizationId: 'org-1' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', configType: 'theme', action: 'create', newValue: 'Oscuro' }));
  });

  describe('activate', () => {
    it('inexistente => NotFound', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.activate('org-1', 'u1', 't-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('tema de otra organización => Forbidden y no se activa', async () => {
      repo.findById.mockResolvedValue(theme({ organizationId: 'org-2' }));

      await expect(service.activate('org-1', 'u1', 't-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.activate).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('el tema por defecto del sistema no se activa directamente => Conflict', async () => {
      repo.findById.mockResolvedValue(theme({ isSystemDefault: true }));

      await expect(service.activate('org-1', 'u1', 't-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('activa, audita y emite el evento con la organización', async () => {
      repo.findById.mockResolvedValue(theme());

      await service.activate('org-1', 'u1', 't-1');

      expect(repo.activate).toHaveBeenCalledWith('t-1', 'org-1');
      expect(events.emit).toHaveBeenCalledWith('config.theme.activated', { organizationId: 'org-1', themeId: 't-1' });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'activate', newValue: 't-1' }));
    });
  });

  describe('remove', () => {
    it('inexistente => NotFound', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.remove('org-1', 'u1', 't-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
      ['de otra organización', { organizationId: 'org-2' }, ForbiddenException],
      ['activo', { isActive: true }, ConflictException],
      ['por defecto del sistema', { isSystemDefault: true }, ConflictException],
    ])('un tema %s no se borra', async (_label, over, errorClass) => {
      repo.findById.mockResolvedValue(theme(over));

      await expect(service.remove('org-1', 'u1', 't-1')).rejects.toBeInstanceOf(errorClass);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('borra un tema propio e inactivo y audita', async () => {
      repo.findById.mockResolvedValue(theme());

      await service.remove('org-1', 'u1', 't-1');

      expect(repo.remove).toHaveBeenCalledWith('t-1');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete', previousValue: 't-1' }));
    });
  });
});
