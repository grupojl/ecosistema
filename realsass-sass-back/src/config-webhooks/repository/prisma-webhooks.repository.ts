import { Injectable }    from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma }   from '@/generated/prisma';
import type { IWebhooksRepository } from '@/config-webhooks/repository/webhooks.repository.interface';
import type { WebhookEndpoint, WebhookDeliveryLog, PersistWebhookInput } from '@/domain/webhook.entity';

type PrismaWebhook = Prisma.WebhookEndpointGetPayload<Record<string, never>>;
type PrismaLog     = Prisma.WebhookDeliveryLogGetPayload<Record<string, never>>;

@Injectable()
export class PrismaWebhooksRepository implements IWebhooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Nunca incluye secretEncrypted: el secreto no sale de la capa de persistencia.
  private toEndpoint(row: PrismaWebhook): WebhookEndpoint {
    return {
      id:              row.id,
      organizationId:  row.organizationId,
      url:             row.url,
      events:          Array.isArray(row.events) ? (row.events as string[]) : [],
      description:     row.description,
      isActive:        row.isActive,
      secretHint:      row.secretPrefix,
      lastTriggeredAt: row.lastTriggeredAt,
      failureCount:    row.failureCount,
      createdAt:       row.createdAt,
      updatedAt:       row.updatedAt,
    };
  }

  private toLog(row: PrismaLog): WebhookDeliveryLog {
    return {
      id:         row.id,
      webhookId:  row.webhookId,
      event:      row.event,
      statusCode: row.statusCode,
      success:    row.success,
      duration:   row.duration,
      attempt:    row.attempt,
      error:      row.error,
      createdAt:  row.createdAt,
    };
  }

  async findActiveByOrg(organizationId: string): Promise<WebhookEndpoint[]> {
    const rows = await this.prisma.webhookEndpoint.findMany({ where: { organizationId, isActive: true } });
    return rows.map(r => this.toEndpoint(r));
  }

  async findAllByOrg(organizationId: string): Promise<WebhookEndpoint[]> {
    const rows = await this.prisma.webhookEndpoint.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } });
    return rows.map(r => this.toEndpoint(r));
  }

  async findById(id: string, organizationId: string): Promise<WebhookEndpoint | null> {
    const row = await this.prisma.webhookEndpoint.findFirst({ where: { id, organizationId } });
    return row ? this.toEndpoint(row) : null;
  }

  async create(input: PersistWebhookInput): Promise<WebhookEndpoint> {
    const row = await this.prisma.webhookEndpoint.create({
      data: {
        organizationId:  input.organizationId,
        url:             input.url,
        events:          input.events,
        description:     input.description ?? null,
        secretEncrypted: input.secretEncrypted,
        secretPrefix:    input.secretHint,
        isActive:        true,
      },
    });
    return this.toEndpoint(row);
  }

  async updateSecret(id: string, organizationId: string, secretEncrypted: string, secretHint: string): Promise<boolean> {
    const res = await this.prisma.webhookEndpoint.updateMany({
      where: { id, organizationId }, data: { secretEncrypted, secretPrefix: secretHint },
    });
    return res.count > 0;
  }

  async remove(id: string, organizationId: string): Promise<boolean> {
    const res = await this.prisma.webhookEndpoint.deleteMany({ where: { id, organizationId } });
    return res.count > 0;
  }

  async getLogs(webhookId: string, take: number): Promise<WebhookDeliveryLog[]> {
    const rows = await this.prisma.webhookDeliveryLog.findMany({
      where: { webhookId }, take, orderBy: { createdAt: 'desc' },
    });
    return rows.map(r => this.toLog(r));
  }
}
