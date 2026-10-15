import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigSecretsService } from '@/config-secrets/config-secrets.service';
import type { ISecretsRepository } from '@/config-secrets/repository/secrets.repository.interface';
import type { CryptoService } from '@/config-secrets/crypto.service';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';

describe('ConfigSecretsService', () => {
  const repo = { findAllByOrg: jest.fn(), findActiveByKey: jest.fn(), findById: jest.fn(), create: jest.fn(), updateValue: jest.fn(), revoke: jest.fn() };
  const crypto = { encrypt: jest.fn((v: string) => ({ encrypted: `enc(${v})`, iv: 'iv', tag: 'tag' })) };
  const audit = { log: jest.fn() };
  const service = new ConfigSecretsService(
    repo as unknown as ISecretsRepository,
    crypto as unknown as CryptoService,
    audit as unknown as ConfigAuditService,
  );

  const dto = { key: 'STRIPE_KEY', value: 'sk_live_abcdefgh1234', description: 'pagos', systemTarget: 'all' };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findActiveByKey.mockResolvedValue(null);
    repo.create.mockImplementation(async (i: unknown) => ({ id: 's-1', ...(i as object) }));
  });

  describe('create', () => {
    it('una clave activa con el mismo nombre => Conflict (hay que rotarla)', async () => {
      repo.findActiveByKey.mockResolvedValue({ id: 's-0' });

      await expect(service.create('org-1', 'u1', dto)).rejects.toBeInstanceOf(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('guarda solo el valor cifrado y una pista de 4 caracteres; nunca el valor en claro', async () => {
      await service.create('org-1', 'u1', dto, '1.2.3.4');

      const saved = repo.create.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(saved).toMatchObject({ organizationId: 'org-1', valueEncrypted: `enc(${dto.value})`, valueIv: 'iv', valueTag: 'tag', hint: '1234' });
      expect(JSON.stringify(saved)).not.toContain(`"${dto.value}"`);
    });

    it('la auditoría registra quién y qué clave, nunca el valor', async () => {
      await service.create('org-1', 'u1', dto, '1.2.3.4');

      const entry = audit.log.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(entry).toMatchObject({ organizationId: 'org-1', userId: 'u1', configKey: 'STRIPE_KEY', action: 'create', ipAddress: '1.2.3.4' });
      expect(JSON.stringify(entry)).not.toContain(dto.value);
    });

    it('valores cortos (≤ 8) no filtran ni un carácter en la pista', async () => {
      await service.create('org-1', 'u1', { ...dto, value: 'abcd1234' });

      expect(repo.create.mock.calls[0]?.[0]).toMatchObject({ hint: '' });
    });

    it('guarda expiresAt como fecha solo si viene', async () => {
      await service.create('org-1', 'u1', dto);
      expect(repo.create.mock.calls[0]?.[0]).not.toHaveProperty('expiresAt');

      await service.create('org-1', 'u1', { ...dto, key: 'OTRA', expiresAt: '2030-01-01T00:00:00.000Z' });
      expect((repo.create.mock.calls[1]?.[0] as { expiresAt: Date }).expiresAt).toEqual(new Date('2030-01-01T00:00:00.000Z'));
    });
  });

  describe('rotate / revoke', () => {
    it.each([
      ['inexistente', null],
      ['revocada', { id: 's-1', key: 'K', isActive: false }],
    ])('rotar una clave %s => NotFound', async (_label, found) => {
      repo.findById.mockResolvedValue(found);

      await expect(service.rotate('org-1', 'u1', 's-1', 'nuevo-valor-123')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.updateValue).not.toHaveBeenCalled();
    });

    it('rotar acotado a la organización: findById y updateValue reciben org-1', async () => {
      repo.findById.mockResolvedValue({ id: 's-1', key: 'K', isActive: true });
      repo.updateValue.mockResolvedValue({ id: 's-1' });

      await service.rotate('org-1', 'u1', 's-1', 'nuevo-valor-123');

      expect(repo.findById).toHaveBeenCalledWith('s-1', 'org-1');
      expect(repo.updateValue).toHaveBeenCalledWith('s-1', 'org-1', { valueEncrypted: 'enc(nuevo-valor-123)', valueIv: 'iv', valueTag: 'tag', hint: '-123' });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'rotate', configKey: 'K' }));
    });

    it('si la actualización no afectó filas (carrera) => NotFound y sin auditoría', async () => {
      repo.findById.mockResolvedValue({ id: 's-1', key: 'K', isActive: true });
      repo.updateValue.mockResolvedValue(null);

      await expect(service.rotate('org-1', 'u1', 's-1', 'nuevo-valor-123')).rejects.toBeInstanceOf(NotFoundException);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('revocar una clave ajena o ya revocada => NotFound', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.revoke('org-1', 'u1', 's-9')).rejects.toBeInstanceOf(NotFoundException);

      repo.findById.mockResolvedValue({ id: 's-1', key: 'K', isActive: false });
      await expect(service.revoke('org-1', 'u1', 's-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.revoke).not.toHaveBeenCalled();
    });

    it('revoca acotado a la organización y audita', async () => {
      repo.findById.mockResolvedValue({ id: 's-1', key: 'K', isActive: true });

      await expect(service.revoke('org-1', 'u1', 's-1')).resolves.toEqual({ ok: true });
      expect(repo.revoke).toHaveBeenCalledWith('s-1', 'org-1');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'revoke', configKey: 'K' }));
    });
  });

  it('list pide solo las claves de la organización', async () => {
    repo.findAllByOrg.mockResolvedValue([]);

    await service.list('org-1');

    expect(repo.findAllByOrg).toHaveBeenCalledWith('org-1');
  });
});
