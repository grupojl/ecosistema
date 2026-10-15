import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigWebhooksService } from '@/config-webhooks/config-webhooks.service';
import { UnsafeUrlError } from '@/common/security/assert-public-url';
import type { IWebhooksRepository } from '@/config-webhooks/repository/webhooks.repository.interface';
import type { ConfigAuditService } from '@/config-audit/config-audit.service';
import type { WebhookDeliveryService } from '@/config-webhooks/webhook-delivery.service';
import type { CryptoService } from '@/config-secrets/crypto.service';

jest.mock('@/common/security/assert-public-url', () => ({
  ...jest.requireActual('@/common/security/assert-public-url'),
  assertPublicHttpUrl: jest.fn(),
}));
import { assertPublicHttpUrl } from '@/common/security/assert-public-url';

const assertUrl = assertPublicHttpUrl as jest.Mock;

describe('ConfigWebhooksService', () => {
  const repo = {
    findAllByOrg: jest.fn(), findActiveByOrg: jest.fn(), findById: jest.fn(), create: jest.fn(),
    updateSecret: jest.fn(), remove: jest.fn(), getLogs: jest.fn(),
  };
  const audit = { log: jest.fn() };
  const delivery = { dispatchTo: jest.fn() };
  // Doble opaco (como el cifrado real): la salida no contiene el texto original.
  const sealed = (v: string) => `sealed:${Buffer.from(v).toString('hex')}`;
  const crypto = { seal: jest.fn(sealed) };
  const service = new ConfigWebhooksService(
    repo as unknown as IWebhooksRepository,
    audit as unknown as ConfigAuditService,
    delivery as unknown as WebhookDeliveryService,
    crypto as unknown as CryptoService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    assertUrl.mockResolvedValue(undefined);
    repo.create.mockImplementation(async (i: unknown) => ({ id: 'wh-1', ...(i as object) }));
  });

  describe('create', () => {
    it('rechaza una URL no pública (anti-SSRF) y no persiste nada', async () => {
      assertUrl.mockRejectedValue(new UnsafeUrlError('IP privada'));

      await expect(service.create('org-1', 'u1', { url: 'http://10.0.0.1/x', events: ['a'] })).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('un error inesperado del validador NO se disfraza de 400', async () => {
      assertUrl.mockRejectedValue(new Error('DNS caído'));

      await expect(service.create('org-1', 'u1', { url: 'https://a.co', events: [] })).rejects.toThrow('DNS caído');
    });

    it('devuelve el secreto en claro una sola vez y guarda solo la versión cifrada y su pista', async () => {
      const { webhook, secret } = await service.create('org-1', 'u1', { url: 'https://a.co/h', events: ['order.created'], description: 'd' });

      expect(secret).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
      const persisted = repo.create.mock.calls[0]?.[0] as { secretEncrypted: string; secretHint: string; organizationId: string; description: string };
      expect(persisted.secretEncrypted).toBe(sealed(secret));
      expect(persisted.secretEncrypted).not.toContain(secret);
      expect(persisted.secretHint).toBe(secret.slice(-4));
      expect(persisted.organizationId).toBe('org-1');
      expect(persisted.description).toBe('d');
      expect(JSON.stringify(webhook)).not.toContain(secret);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1', configType: 'webhook', action: 'create' }));
    });

    it('sin descripción no manda la clave description', async () => {
      await service.create('org-1', 'u1', { url: 'https://a.co/h', events: [] });

      expect(repo.create.mock.calls[0]?.[0]).not.toHaveProperty('description');
    });

    it('cada alta genera un secreto distinto', async () => {
      const a = await service.create('org-1', 'u1', { url: 'https://a.co/h', events: [] });
      const b = await service.create('org-1', 'u1', { url: 'https://a.co/h', events: [] });

      expect(a.secret).not.toBe(b.secret);
    });
  });

  describe('rotateSecret', () => {
    it('webhook de otra organización (o inexistente) => NotFound y no toca el secreto', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.rotateSecret('org-1', 'u1', 'wh-ajeno')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findById).toHaveBeenCalledWith('wh-ajeno', 'org-1');
      expect(repo.updateSecret).not.toHaveBeenCalled();
    });

    it('guarda el nuevo secreto cifrado, acotado a la organización, y lo devuelve una vez', async () => {
      repo.findById.mockResolvedValue({ id: 'wh-1' });

      const out = await service.rotateSecret('org-1', 'u1', 'wh-1');

      expect(repo.updateSecret).toHaveBeenCalledWith('wh-1', 'org-1', sealed(out.secret), out.secret.slice(-4));
      expect(out.webhookId).toBe('wh-1');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'rotate', previousValue: 'wh-1' }));
    });
  });

  describe('remove', () => {
    it('si el repositorio no borró nada => NotFound y sin auditoría', async () => {
      repo.remove.mockResolvedValue(false);

      await expect(service.remove('org-1', 'u1', 'wh-9')).rejects.toBeInstanceOf(NotFoundException);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('borra acotado a la organización y audita', async () => {
      repo.remove.mockResolvedValue(true);

      await expect(service.remove('org-1', 'u1', 'wh-1')).resolves.toEqual({ ok: true });
      expect(repo.remove).toHaveBeenCalledWith('wh-1', 'org-1');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete' }));
    });
  });

  describe('getLogs / test / list', () => {
    it('getLogs verifica el dueño antes de leer los logs', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.getLogs('org-1', 'wh-ajeno')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.getLogs).not.toHaveBeenCalled();
    });

    it('getLogs usa 50 por defecto y respeta el límite pedido', async () => {
      repo.findById.mockResolvedValue({ id: 'wh-1' });
      repo.getLogs.mockResolvedValue([]);

      await service.getLogs('org-1', 'wh-1');
      await service.getLogs('org-1', 'wh-1', 5);

      expect(repo.getLogs).toHaveBeenNthCalledWith(1, 'wh-1', 50);
      expect(repo.getLogs).toHaveBeenNthCalledWith(2, 'wh-1', 5);
    });

    it('test envía un evento de prueba solo a un webhook propio', async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(service.test('org-1', 'wh-ajeno')).rejects.toBeInstanceOf(NotFoundException);
      expect(delivery.dispatchTo).not.toHaveBeenCalled();

      repo.findById.mockResolvedValueOnce({ id: 'wh-1' });
      await expect(service.test('org-1', 'wh-1')).resolves.toEqual({ ok: true });
      expect(delivery.dispatchTo).toHaveBeenCalledWith('wh-1', 'test', { test: true, organizationId: 'org-1' });
    });

    it('list devuelve solo los de la organización pedida', async () => {
      repo.findAllByOrg.mockResolvedValue([{ id: 'wh-1' }]);

      await expect(service.list('org-1')).resolves.toEqual([{ id: 'wh-1' }]);
      expect(repo.findAllByOrg).toHaveBeenCalledWith('org-1');
    });
  });
});
