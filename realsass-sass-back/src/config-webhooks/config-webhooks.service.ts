import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { randomBytes }           from 'node:crypto';
import { ConfigAuditService }    from '@/config-audit/config-audit.service';
import { CryptoService }         from '@/config-secrets/crypto.service';
import { WebhookDeliveryService } from '@/config-webhooks/webhook-delivery.service';
import { CreateWebhookDto }      from '@/config-webhooks/dto/create-webhook.dto';
import { assertPublicHttpUrl, UnsafeUrlError } from '@/common/security/assert-public-url';
import { WEBHOOKS_REPOSITORY, type IWebhooksRepository } from '@/config-webhooks/repository/webhooks.repository.interface';

/** Secreto de firma: aleatorio, con prefijo reconocible. Se muestra UNA vez y luego solo su pista. */
function newSigningSecret(): string {
  return 'whsec_' + randomBytes(32).toString('base64url');
}
const hintOf = (secret: string) => secret.slice(-4);

@Injectable()
export class ConfigWebhooksService {
  constructor(
    @Inject(WEBHOOKS_REPOSITORY)
    private readonly repo:     IWebhooksRepository,
    private readonly audit:    ConfigAuditService,
    private readonly delivery: WebhookDeliveryService,
    private readonly crypto:   CryptoService,
  ) {}

  async list(organizationId: string) {
    return this.repo.findAllByOrg(organizationId);
  }

  private async assertSafeUrl(url: string): Promise<void> {
    try { await assertPublicHttpUrl(url); }
    catch (e) {
      if (e instanceof UnsafeUrlError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  /** Devuelve el webhook y su secreto de firma EN CLARO, una sola vez. */
  async create(organizationId: string, userId: string, dto: CreateWebhookDto) {
    await this.assertSafeUrl(dto.url);
    const secret  = newSigningSecret();
    const webhook = await this.repo.create({
      organizationId, url: dto.url, events: dto.events, ...(dto.description ? { description: dto.description } : {}),
      secretEncrypted: this.crypto.seal(secret), secretHint: hintOf(secret),
    });
    this.audit.log({ organizationId, userId, configType: 'webhook', action: 'create', newValue: dto.url });
    return { webhook, secret };
  }

  /** Reemplaza el secreto de firma (el anterior deja de ser válido). Devuelve el nuevo, una sola vez. */
  async rotateSecret(organizationId: string, userId: string, id: string) {
    const webhook = await this.repo.findById(id, organizationId);
    if (!webhook) throw new NotFoundException('Webhook no encontrado');
    const secret = newSigningSecret();
    await this.repo.updateSecret(id, organizationId, this.crypto.seal(secret), hintOf(secret));
    this.audit.log({ organizationId, userId, configType: 'webhook', action: 'rotate', previousValue: id });
    return { webhookId: id, secret };
  }

  async remove(organizationId: string, userId: string, id: string) {
    if (!(await this.repo.remove(id, organizationId))) throw new NotFoundException('Webhook no encontrado');
    this.audit.log({ organizationId, userId, configType: 'webhook', action: 'delete', previousValue: id });
    return { ok: true };
  }

  async getLogs(organizationId: string, id: string, take = 50) {
    if (!(await this.repo.findById(id, organizationId))) throw new NotFoundException('Webhook no encontrado');
    return this.repo.getLogs(id, take);
  }

  /** Envía un evento de prueba a ESTE webhook (sin depender de su filtro de eventos). */
  async test(organizationId: string, id: string) {
    const webhook = await this.repo.findById(id, organizationId);
    if (!webhook) throw new NotFoundException('Webhook no encontrado');
    await this.delivery.dispatchTo(webhook.id, 'test', { test: true, organizationId });
    return { ok: true };
  }
}
