import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigThemesService } from './config-themes.service';

const make = () => {
  const repo = {
    findPublicByOrgId: jest.fn(),
    findAllByOrg: jest.fn(),
    create: jest.fn(async (d: Record<string, unknown>) => ({ id: 't1', ...d })),
    findById: jest.fn(),
    activate: jest.fn(),
    remove: jest.fn(),
  };
  const audit = { log: jest.fn() };
  const events = { emit: jest.fn() };
  return { svc: new ConfigThemesService(repo as never, {} as never, audit as never, events as never), repo, audit, events };
};

describe('ConfigThemesService', () => {
  it('create fuerza la organización del contexto, no la del dto', async () => {
    const { svc, repo, audit } = make();
    await svc.create('org-1', 'u', { name: 'Oscuro', organizationId: 'org-ajena' } as never);
    expect(repo.create.mock.calls[0]![0].organizationId).toBe('org-1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', newValue: 'Oscuro' }));
  });

  describe.each(['activate', 'remove'] as const)('%s', (op) => {
    const run = (svc: ConfigThemesService) => svc[op]('org-1', 'u', 't1');

    it('404 si no existe', async () => {
      const { svc, repo } = make();
      repo.findById.mockResolvedValue(null);
      await expect(run(svc)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('403 si el tema es de otra organización y no toca nada', async () => {
      const { svc, repo } = make();
      repo.findById.mockResolvedValue({ organizationId: 'org-2' });
      await expect(run(svc)).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.activate).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('409 si es el tema de sistema', async () => {
      const { svc, repo } = make();
      repo.findById.mockResolvedValue({ organizationId: 'org-1', isSystemDefault: true, isActive: false });
      await expect(run(svc)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('activate activa, audita y emite el evento', async () => {
    const { svc, repo, audit, events } = make();
    repo.findById.mockResolvedValue({ organizationId: 'org-1', isSystemDefault: false });
    await svc.activate('org-1', 'u', 't1');
    expect(repo.activate).toHaveBeenCalledWith('t1', 'org-1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'activate' }));
    expect(events.emit).toHaveBeenCalledWith('config.theme.activated', { organizationId: 'org-1', themeId: 't1' });
  });

  it('remove no borra el tema activo', async () => {
    const { svc, repo } = make();
    repo.findById.mockResolvedValue({ organizationId: 'org-1', isActive: true });
    await expect(svc.remove('org-1', 'u', 't1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('remove borra uno inactivo y audita', async () => {
    const { svc, repo, audit } = make();
    repo.findById.mockResolvedValue({ organizationId: 'org-1', isActive: false, isSystemDefault: false });
    await svc.remove('org-1', 'u', 't1');
    expect(repo.remove).toHaveBeenCalledWith('t1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete', previousValue: 't1' }));
  });

  it('getPublicTheme y list delegan', async () => {
    const { svc, repo } = make();
    repo.findPublicByOrgId.mockResolvedValue('p');
    repo.findAllByOrg.mockResolvedValue(['a']);
    expect(await svc.getPublicTheme('o')).toBe('p');
    expect(await svc.list('o')).toEqual(['a']);
  });
});
