// src/config-webhooks/webhook-delivery.service.ts
// La queue es opcional: cuando REDIS_ENABLED=false dispatch() es no-op.
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue }                  from '@nestjs/bullmq';
import { Queue }                        from 'bullmq';
import { OnEvent }                      from '@nestjs/event-emitter';
import { PrismaService }                from '../prisma/prisma.service';
import * as crypto                      from 'crypto';

export const WEBHOOK_QUEUE = 'webhook-delivery';

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue | null,
  ) {}

  @OnEvent('config.theme.changed')
  @OnEvent('config.flag.changed')
  @OnEvent('config.secret.rotated')
  @OnEvent('quota.exceeded')
  @OnEvent('member.joined')
  @OnEvent('member.removed')
  async onConfigEvent(payload: { organizationId: string; [key: string]: unknown }) {
    await this.dispatch(payload.organizationId, 'config.changed', payload);
  }

  async dispatch(organizationId: string, event: string, payload: unknown): Promise<void> {
    if (!this.queue) {
      this.logger.debug(`[no-op] dispatch ignorado (Redis deshabilitado): ${event}`);
      return;
    }

    const webhooks = await this.prisma.webhookEndpoint.findMany({
      where: { organizationId, isActive: true },
    });

    for (const wh of webhooks) {
      const events = wh.events as string[];
      if (!events.includes(event) && !events.includes('*')) continue;

      await this.queue.add(
        'deliver',
        { webhookId: wh.id, event, payload, url: wh.url, secretHash: wh.secretHash },
        {
          attempts: Number(process.env['WEBHOOK_MAX_RETRIES'] ?? 3),
          backoff:  { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail:     200,
        },
      );
    }
  }

  signPayload(secret: string, body: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  }
}
