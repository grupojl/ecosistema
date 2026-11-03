import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigSecretsService } from './config-secrets.service';

const make = () => {
  const repo = {
    findAllByOrg: jest.fn(),
    findActiveByKey: jest.fn(),
    create: jest.fn(async (d: unknown) => d),
    findById: jest.fn(),
    updateValue: jest.fn(),
    revoke: jest.fn(),
  };
  const crypto = { encrypt: jest.fn(() => ({ encrypted: 'enc', iv: 'iv', tag: 'tag' })) };
  const audit = { log: jest.fn() };
  return { svc: new ConfigSecretsService(repo as never, crypto as never, audit as never), repo, crypto, audit };
};

describe('ConfigSecretsService', () => {
  it('create cifra el valor, guarda solo los últimos 4 como pista y NO audita el valor', async () => {
    const { svc, repo, audit } = make();
    repo.findActiveByKey.mockResolvedValue(null);
    await svc.create('o', 'u', { key: 'STRIPE', value: 'sk_live_123456789', systemTarget: 's' } as never, '1.1.1.1');
    expect(repo.create.mock.calls[0]![0]).toMatchObject({ valueEncrypted: 'enc', valueIv: 'iv', valueTag: 'tag', hint: '6789' });
    expect(JSON.stringify(repo.create.mock.calls[0]![0])).not.toContain('sk_live_123456789');
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('sk_live');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', configKey: 'STRIPE', ipAddress: '1.1.1.1' }));
  });

  it('valores cortos (<= 8) no dejan pista', async () => {
    const { svc, repo } = make();
    repo.findActiveByKey.mockResolvedValue(null);
    await svc.create('o', 'u', { key: 'K', value: '12345678' } as never);
    expect(repo.create.mock.calls[0]![0].hint).toBe('');
  });

  it('create: 409 si ya hay una clave activa con ese nombre; expiresAt se convierte a Date', async () => {
    const { svc, repo } = make();
    repo.findActiveByKey.mockResolvedValueOnce({ id: 'x' });
    await expect(svc.create('o', 'u', { key: 'K', value: 'v' } as never)).rejects.toBeInstanceOf(ConflictException);
    repo.findActiveByKey.mockResolvedValue(null);
    await svc.create('o', 'u', { key: 'K', value: 'v', expiresAt: '2030-01-01' } as never);
    expect(repo.create.mock.calls[0]![0].expiresAt).toBeInstanceOf(Date);
  });

  it.each(['rotate', 'revoke'] as const)('%s: 404 si la clave no existe o ya está revocada', async (op) => {
    const { svc, repo } = make();
    const call = () => (op === 'rotate' ? svc.rotate('o', 'u', 'id', 'nuevo-valor') : svc.revoke('o', 'u', 'id'));
    repo.findById.mockResolvedValueOnce(null);
    await expect(call()).rejects.toBeInstanceOf(NotFoundException);
    repo.findById.mockResolvedValueOnce({ key: 'K', isActive: false });
    await expect(call()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rotate: re-cifra, y 404 si el repositorio no actualizó (otra organización)', async () => {
    const { svc, repo, audit } = make();
    repo.findById.mockResolvedValue({ key: 'K', isActive: true });
    repo.updateValue.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'id' });
    await expect(svc.rotate('o', 'u', 'id', 'nuevo-valor-123')).rejects.toBeInstanceOf(NotFoundException);
    expect(await svc.rotate('o', 'u', 'id', 'nuevo-valor-123')).toEqual({ id: 'id' });
    expect(repo.updateValue).toHaveBeenLastCalledWith('id', 'o', expect.objectContaining({ hint: '-123' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'rotate', configKey: 'K' }));
  });

  it('revoke: revoca con el id y la organización, y audita', async () => {
    const { svc, repo, audit } = make();
    repo.findById.mockResolvedValue({ key: 'K', isActive: true });
    expect(await svc.revoke('o', 'u', 'id')).toEqual({ ok: true });
    expect(repo.revoke).toHaveBeenCalledWith('id', 'o');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'revoke' }));
  });

  it('list delega en el repositorio', async () => {
    const { svc, repo } = make();
    repo.findAllByOrg.mockResolvedValue([1]);
    expect(await svc.list('o')).toEqual([1]);
  });
});
