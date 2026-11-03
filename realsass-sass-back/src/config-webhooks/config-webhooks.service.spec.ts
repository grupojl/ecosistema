import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigWebhooksService } from './config-webhooks.service';
import { assertPublicHttpUrl, UnsafeUrlError } from '@/common/security/assert-public-url';

jest.mock('@/common/security/assert-public-url', () => {
  class UnsafeUrlError extends Error {}
  return { assertPublicHttpUrl: jest.fn(), UnsafeUrlError };
});
const assertUrl = assertPublicHttpUrl as jest.Mock;

const make = () => {
  const repo = {
    findAllByOrg: jest.fn(),
    create: jest.fn(async (d: Record<string, unknown>) => ({ id: 'w1', ...d })),
    findById: jest.fn(),
    updateSecret: jest.fn(),
    remove: jest.fn(),
    getLogs: jest.fn(),
  };
  const audit = { log: jest.fn() };
  const delivery = { dispatchTo: jest.fn() };
  const crypto = { seal: jest.fn((s: string) => `sealed(${s})`) };
  const svc = new ConfigWebhooksService(repo as never, audit as never, delivery as never, crypto as never);
  return { svc, repo, audit, delivery, crypto };
};

describe('ConfigWebhooksService', () => {
  beforeEach(() => assertUrl.mockReset().mockResolvedValue(new URL('https://x.com')));

  it('create valida la URL, cifra el secreto y lo devuelve en claro UNA vez', async () => {
    const { svc, repo, audit } = make();
    const out = await svc.create('o', 'u', { url: 'https://x.com/h', events: ['*'], description: 'd' } as never);
    expect(out.secret).toMatch(/^whsec_/);
    const saved = repo.create.mock.calls[0]![0] as Record<string, string>;
    expect(saved['secretEncrypted']).toBe(`sealed(${out.secret})`);
    expect(saved['secretHint']).toBe(out.secret.slice(-4));
    expect(JSON.stringify(saved)).not.toContain(out.secret + '"'); // el claro no se persiste
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', newValue: 'https://x.com/h' }));
  });

  it('create rechaza una URL insegura con 400 y no persiste', async () => {
    const { svc, repo } = make();
    assertUrl.mockRejectedValue(new UnsafeUrlError('La URL apunta a una dirección privada o interna'));
    await expect(svc.create('o', 'u', { url: 'https://10.0.0.1', events: [] } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('create propaga errores inesperados de validación', async () => {
    const { svc } = make();
    assertUrl.mockRejectedValue(new Error('boom'));
    await expect(svc.create('o', 'u', { url: 'https://x.com', events: [] } as never)).rejects.toThrow('boom');
  });

  it('rotateSecret reemplaza el secreto, audita y 404 si no es de la organización', async () => {
    const { svc, repo, audit } = make();
    repo.findById.mockResolvedValueOnce(null);
    await expect(svc.rotateSecret('o', 'u', 'w1')).rejects.toBeInstanceOf(NotFoundException);
    repo.findById.mockResolvedValue({ id: 'w1' });
    const out = await svc.rotateSecret('o', 'u', 'w1');
    expect(repo.updateSecret).toHaveBeenCalledWith('w1', 'o', `sealed(${out.secret})`, out.secret.slice(-4));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'rotate' }));
  });

  it('remove: 404 si no borró nada; ok y audita si borró', async () => {
    const { svc, repo, audit } = make();
    repo.remove.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(svc.remove('o', 'u', 'w1')).rejects.toBeInstanceOf(NotFoundException);
    expect(await svc.remove('o', 'u', 'w1')).toEqual({ ok: true });
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('getLogs y test exigen que el webhook sea de la organización', async () => {
    const { svc, repo, delivery } = make();
    repo.findById.mockResolvedValue(null);
    await expect(svc.getLogs('o', 'w1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.test('o', 'w1')).rejects.toBeInstanceOf(NotFoundException);
    expect(delivery.dispatchTo).not.toHaveBeenCalled();

    repo.findById.mockResolvedValue({ id: 'w1' });
    repo.getLogs.mockResolvedValue([1]);
    expect(await svc.getLogs('o', 'w1', 10)).toEqual([1]);
    expect(repo.getLogs).toHaveBeenCalledWith('w1', 10);
    expect(await svc.test('o', 'w1')).toEqual({ ok: true });
    expect(delivery.dispatchTo).toHaveBeenCalledWith('w1', 'test', { test: true, organizationId: 'o' });
  });

  it('list delega en el repositorio', async () => {
    const { svc, repo } = make();
    repo.findAllByOrg.mockResolvedValue([1]);
    expect(await svc.list('o')).toEqual([1]);
  });
});
