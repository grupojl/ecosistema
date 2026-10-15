import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { CryptoService } from '@/config-secrets/crypto.service';
import { WEBHOOK_QUEUE } from '@/config-webhooks/webhook-delivery.service';
import { assertPublicHttpUrl } from '@/common/security/assert-public-url';
import * as crypto from 'crypto';
import { runAsSystem } from '@/prisma/tenant-context';

const TIMEOUT = Number(process.env['WEBHOOK_DELIVERY_TIMEOUT'] ?? 5000);

@Processor(WEBHOOK_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) { super(); }

  /**
   * El job solo lleva el id del webhook (ni el secreto ni la URL: Redis no guarda material de firma), así que el worker
   * no conoce la organización de antemano. Corre como sistema (ADR-027): es código de confianza que solo lee/actualiza
   * el endpoint y su log de entregas; no atiende peticiones de usuarios.
   */
  process(job: Job): Promise<void> {
    return runAsSystem('entrega de webhook (worker BullMQ)', () => this.deliver(job));
  }

  private async deliver(job: Job): Promise<void> {
    const { webhookId, event, payload } = job.data as { webhookId: string; event: string; payload: unknown };
    const start = Date.now();
    let statusCode: number | null = null;
    let success = false;
    let error: string | null = null;

    try {
      const endpoint = await this.prisma.webhookEndpoint.findUnique({ where: { id: webhookId } });
      if (!endpoint || !endpoint.isActive) return; // eliminado o desactivado entre el encolado y la entrega

      // Endpoints creados antes de la firma real tienen el secreto vacío: no se firma con una clave vacía.
      if (!endpoint.secretEncrypted) {
        throw new Error('Webhook sin clave de firma: rotala desde la configuración');
      }
      const secret = this.cryptoService.open(endpoint.secretEncrypted);

      // Se revalida en cada entrega: el DNS pudo cambiar desde que se creó el webhook.
      await assertPublicHttpUrl(endpoint.url);

      // El timestamp va DENTRO del body firmado (no se puede alterar) y también en un header para que el
      // receptor rechace replays sin parsear: recomendado descartar si |now - timestamp| > 5 minutos.
      const timestamp = new Date().toISOString();
      const body      = JSON.stringify({ event, payload, timestamp });
      const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), TIMEOUT);
      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature, 'X-Webhook-Event': event, 'X-Webhook-Timestamp': timestamp },
          body,
          signal: controller.signal,
          redirect: 'error', // un redirect podría llevar a una dirección interna
        });
        statusCode = res.status;
        success    = res.ok;
        if (!res.ok) throw new Error('HTTP ' + res.status);
      } finally {
        clearTimeout(timeout);
      }
    } catch (e: unknown) {
      error = (e instanceof Error ? e.message : String(e)) ?? 'Unknown error';
      this.logger.warn('Webhook ' + webhookId + ' falló (intento ' + (job.attemptsMade + 1) + '): ' + error);
      throw e;
    } finally {
      const duration = Date.now() - start;
      await this.prisma.webhookDeliveryLog.create({
        data: { webhookId, event, statusCode, success, duration, attempt: job.attemptsMade + 1, error },
      }).catch(() => undefined);
      await this.prisma.webhookEndpoint.update({
        where: { id: webhookId },
        data: { lastTriggeredAt: new Date(), failureCount: success ? 0 : { increment: 1 } },
      }).catch(() => undefined);
    }
  }
}
