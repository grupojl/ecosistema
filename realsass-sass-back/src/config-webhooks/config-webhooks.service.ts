import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ConfigAuditService }    from '../config-audit/config-audit.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { CreateWebhookDto }      from './dto/create-webhook.dto';
import { WEBHOOKS_REPOSITORY, type IWebhooksRepository } from './repository/webhooks.repository.interface';

@Injectable()
export class ConfigWebhooksService {
  constructor(
    @Inject(WEBHOOKS_REPOSITORY)
    private readonly repo:     IWebhooksRepository,
    private readonly audit:    ConfigAuditService,
    private readonly delivery: WebhookDeliveryService,
  ) {}

  async list(organizationId: string) {
    return this.repo.findAllByOrg(organizationId);
  }

  async create(organizationId: string, userId: string, dto: CreateWebhookDto) {
    const webhook = await this.repo.create({ organizationId, url: dto.url, events: dto.events });
    this.audit.log({ organizationId, userId, configType: 'webhook', action: 'create', newValue: dto.url });
    return webhook;
  }

  async remove(organizationId: string, userId: string, id: string) {
    const webhook = await this.repo.findById(id);
    if (!webhook) throw new NotFoundException(`Webhook ${id} not found`);
    await this.repo.remove(id);
    this.audit.log({ organizationId, userId, configType: 'webhook', action: 'delete', previousValue: id });
  }

  async getLogs(organizationId: string, id: string, take = 50) {
    const webhook = await this.repo.findById(id);
    if (!webhook || webhook.organizationId !== organizationId) throw new NotFoundException();
    return this.repo.getLogs(id, take);
  }

  async test(organizationId: string, id: string) {
    const webhook = await this.repo.findById(id);
    if (!webhook || webhook.organizationId !== organizationId) throw new NotFoundException();
    await this.delivery.dispatch(webhook, 'test', { test: true });
    return { ok: true };
  }
}
