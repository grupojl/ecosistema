import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { IWebhooksRepository } from './webhooks.repository.interface';
import type { WebhookEndpoint, WebhookDeliveryLog, CreateWebhookInput } from '../domain/webhook.entity';

type PrismaWebhook = Prisma.WebhookEndpointGetPayload<Record<string, never>>;
type PrismaLog     = Prisma.WebhookDeliveryLogGetPayload<Record<string, never>>;

@Injectable()
export class PrismaWebhooksRepository implements IWebhooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEndpoint(row: PrismaWebhook): WebhookEndpoint {
    return {
      id:             row.id,
      organizationId: row.organizationId,
      url:            row.url,
      events:         row.events as string[],
      isActive:       row.isActive,
      createdAt:      row.createdAt,
      updatedAt:      row.updatedAt,
    };
  }

  private toLog(row: PrismaLog): WebhookDeliveryLog {
    return {
      id:           row.id,
      webhookId:    row.webhookId,
      event:        row.event,
      statusCode:   row.statusCode,
      success:      row.success,
      responseBody: row.responseBody,
      createdAt:    row.createdAt,
    };
  }

  async findAllByOrg(organizationId: string): Promise<WebhookEndpoint[]> {
    const rows = await this.prisma.webhookEndpoint.findMany({ where: { organizationId } });
    return rows.map(r => this.toEndpoint(r));
  }

  async findById(id: string): Promise<WebhookEndpoint | null> {
    const row = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    return row ? this.toEndpoint(row) : null;
  }

  async create(input: CreateWebhookInput): Promise<WebhookEndpoint> {
    const row = await this.prisma.webhookEndpoint.create({
      data: { organizationId: input.organizationId, url: input.url, events: input.events, isActive: true },
    });
    return this.toEndpoint(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.webhookEndpoint.delete({ where: { id } });
  }

  async getLogs(webhookId: string, take: number): Promise<WebhookDeliveryLog[]> {
    const rows = await this.prisma.webhookDeliveryLog.findMany({
      where: { webhookId }, take, orderBy: { createdAt: 'desc' },
    });
    return rows.map(r => this.toLog(r));
  }
}
