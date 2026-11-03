import { NotFoundException } from '@nestjs/common';
import { ConfigTemplatesService } from './config-templates.service';

const make = () => {
  const repo = { findAllByOrg: jest.fn(), findByKey: jest.fn(), create: jest.fn() };
  const audit = { log: jest.fn() };
  return { svc: new ConfigTemplatesService(repo as never, {} as never, audit as never), repo, audit };
};

describe('ConfigTemplatesService', () => {
  it('renderTemplate reemplaza variables y deja intactas las que faltan', () => {
    const { svc } = make();
    expect(svc.renderTemplate('Hola {{name}}, orden {{id}} {{x}}', { name: 'Ana', id: '7' })).toBe(
      'Hola Ana, orden 7 {{x}}',
    );
  });

  it('resolve lanza 404 si la plantilla no existe', async () => {
    const { svc, repo } = make();
    repo.findByKey.mockResolvedValue(null);
    await expect(svc.resolve('o', 'k')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renderByKey resuelve y renderiza', async () => {
    const { svc, repo } = make();
    repo.findByKey.mockResolvedValue({ key: 'welcome', content: 'Hola {{name}}' });
    expect(await svc.renderByKey('o', 'welcome', { name: 'Ana' })).toEqual({ key: 'welcome', rendered: 'Hola Ana' });
  });

  it('create persiste con la organización y audita', async () => {
    const { svc, repo, audit } = make();
    repo.create.mockResolvedValue({ id: 't' });
    await svc.create('o', 'u', { key: 'k', content: 'c' } as never);
    expect(repo.create).toHaveBeenCalledWith({ organizationId: 'o', key: 'k', content: 'c' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ configType: 'template', action: 'create' }));
  });

  it('list delega en el repositorio', async () => {
    const { svc, repo } = make();
    repo.findAllByOrg.mockResolvedValue([1]);
    expect(await svc.list('o')).toEqual([1]);
  });
});
