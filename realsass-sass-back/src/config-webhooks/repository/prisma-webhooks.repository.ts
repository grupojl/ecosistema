import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { IWebhooksRepository } from './webhooks.repository.interface';
import type { WebhookEndpoint, WebhookDeliveryLog, CreateWebhookInput } from '../domain/webhook.entity';

@Injectable()
export class PrismaWebhooksRepository implements IWebhooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOrg(organizationId: string): Promise<WebhookEndpoint[]> {
    return this.prisma.webhookEndpoint.findMany({ where: { organizationId } }) as unknown as WebhookEndpoint[];
  }

  async findById(id: string): Promise<WebhookEndpoint | null> {
    return this.prisma.webhookEndpoint.findUnique({ where: { id } }) as unknown as WebhookEndpoint | null;
  }

  async create(input: CreateWebhookInput): Promise<WebhookEndpoint> {
    return this.prisma.webhookEndpoint.create({
      data: { organizationId: input.organizationId, url: input.url, events: input.events, isActive: true },
    }) as unknown as WebhookEndpoint;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.webhookEndpoint.delete({ where: { id } });
  }

  async getLogs(webhookId: string, take: number): Promise<WebhookDeliveryLog[]> {
    return this.prisma.webhookDeliveryLog.findMany({
      where: { webhookId }, take, orderBy: { createdAt: 'desc' },
    }) as unknown as WebhookDeliveryLog[];
  }
}
