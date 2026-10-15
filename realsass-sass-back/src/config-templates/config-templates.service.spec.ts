import { NotFoundException } from '@nestjs/common';
import { ConfigTemplatesService } from '@/config-templates/config-templates.service';
import type { ITemplatesRepository } from '@/config-templates/repository/templates.repository.interface';
import type { ConfigCacheService } from '@/config-cache/config-cache.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';

describe('ConfigTemplatesService', () => {
  const repo = { findAllByOrg: jest.fn(), findByKey: jest.fn(), create: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new ConfigTemplatesService(
    repo as unknown as ITemplatesRepository,
    {} as unknown as ConfigCacheService,
    audit as unknown as ConfigAuditService,
  );

  beforeEach(() => jest.clearAllMocks());

  describe('renderTemplate', () => {
    it('reemplaza {{variables}}', () => {
      expect(service.renderTemplate('Hola {{nombre}}, tu pedido {{id}}', { nombre: 'Ana', id: '42' })).toBe('Hola Ana, tu pedido 42');
    });

    it('deja intacta la variable que falta (no la borra ni escribe "undefined")', () => {
      expect(service.renderTemplate('Hola {{nombre}} {{apellido}}', { nombre: 'Ana' })).toBe('Hola Ana {{apellido}}');
    });

    it('reemplaza todas las apariciones y no interpreta expresiones', () => {
      expect(service.renderTemplate('{{a}}-{{a}}-{{a.b}}-{{ a }}', { a: 'x' })).toBe('x-x-{{a.b}}-{{ a }}');
    });

    it('no ejecuta ni reinterpreta el valor insertado', () => {
      expect(service.renderTemplate('{{a}}', { a: '{{b}}', b: 'secreto' })).toBe('{{b}}');
    });
  });

  describe('resolve / renderByKey', () => {
    it('una clave inexistente en la organización => NotFound', async () => {
      repo.findByKey.mockResolvedValue(null);

      await expect(service.resolve('org-1', 'welcome')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findByKey).toHaveBeenCalledWith('org-1', 'welcome');
    });

    it('renderByKey resuelve y renderiza', async () => {
      repo.findByKey.mockResolvedValue({ key: 'welcome', content: 'Hola {{n}}' });

      await expect(service.renderByKey('org-1', 'welcome', { n: 'Ana' })).resolves.toEqual({ key: 'welcome', rendered: 'Hola Ana' });
    });
  });

  it('create fuerza organizationId y audita', async () => {
    repo.create.mockResolvedValue({ id: 't-1' });

    await service.create('org-1', 'u1', { key: 'welcome', content: 'Hola' });

    expect(repo.create).toHaveBeenCalledWith({ organizationId: 'org-1', key: 'welcome', content: 'Hola' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', configType: 'template', configKey: 'welcome', action: 'create' }));
  });

  it('list consulta solo la organización pedida', async () => {
    await service.list('org-1');

    expect(repo.findAllByOrg).toHaveBeenCalledWith('org-1');
  });
});
