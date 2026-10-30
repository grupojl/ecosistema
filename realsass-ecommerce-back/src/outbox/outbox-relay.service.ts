import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  PrismaService,
  type PrismaTransactionClient,
} from '@/prisma/prisma.service';
import { setSystemContext } from '@/prisma/tenant-context';
import { MAX_ATTEMPTS, nextDelayMs } from '@/outbox/outbox-backoff';
import {
  OUTBOX_PUBLISHER,
  type OutboxEventRecord,
  type OutboxPublisher,
} from '@/outbox/outbox.types';

export interface RelayResult {
  published: number;
  failed: number;
}

const BATCH_SIZE = 20;
const POLL_MS = 2_000;

/**
 * OutboxRelayService — publica los eventos pendientes (ADR-029).
 *
 * · `FOR UPDATE SKIP LOCKED`: varias instancias del back pueden correr el relay a la vez sin publicar el mismo evento dos veces.
 * · Entrega AT-LEAST-ONCE: si el proceso cae entre publicar y marcar, el evento se reenvía. Los consumidores deben ser idempotentes (usar `id`).
 * · Un fallo reintenta con espera creciente; tras MAX_ATTEMPTS queda en la tabla (attempts = MAX, sin procesar) para revisión manual.
 * · Se activa con OUTBOX_RELAY_ENABLED=true (junto con OUTBOX_ENABLED, que es quien escribe).
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OUTBOX_PUBLISHER) private readonly publisher: OutboxPublisher,
  ) {}

  onModuleInit(): void {
    if (process.env['OUTBOX_RELAY_ENABLED'] !== 'true') return;
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_MS);
    this.timer.unref();
    this.logger.log('Relay del outbox activo');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return; // no se solapan las vueltas
    this.running = true;
    try {
      await this.processBatch();
    } catch (error) {
      this.logger.error(`Fallo del relay: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async processBatch(limit = BATCH_SIZE): Promise<RelayResult> {
    return this.prisma.$transaction(
      async (raw) => {
        const tx = raw as unknown as PrismaTransactionClient;
        await setSystemContext(tx); // el relay no pertenece a un tenant: con RLS activo necesita el contexto de sistema
        const claimed = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM outbox_events
        WHERE  processed_at IS NULL AND available_at <= ${new Date()} AND attempts < ${MAX_ATTEMPTS}
        ORDER  BY created_at ASC
        LIMIT  ${limit}
        FOR UPDATE SKIP LOCKED
      `;
        if (claimed.length === 0) return { published: 0, failed: 0 };

        const rows = await tx.outboxEvent.findMany({
          where: { id: { in: claimed.map((c) => c.id) } },
          orderBy: { createdAt: 'asc' },
        });

        const result: RelayResult = { published: 0, failed: 0 };
        for (const row of rows) {
          const event: OutboxEventRecord = {
            id: row.id,
            organizationId: row.organizationId,
            aggregateType: row.aggregateType,
            aggregateId: row.aggregateId,
            type: row.type,
            payload: row.payload as Record<string, unknown>,
            attempts: row.attempts,
            createdAt: row.createdAt,
          };
          try {
            await this.publisher.publish(event);
            await tx.outboxEvent.update({
              where: { id: row.id },
              data: { processedAt: new Date(), lastError: null },
            });
            result.published++;
          } catch (error) {
            const attempts = row.attempts + 1;
            await tx.outboxEvent.update({
              where: { id: row.id },
              data: {
                attempts,
                availableAt: new Date(Date.now() + nextDelayMs(attempts)),
                lastError: (error instanceof Error
                  ? error.message
                  : String(error)
                ).slice(0, 500),
              },
            });
            if (attempts >= MAX_ATTEMPTS)
              this.logger.error(
                `Evento ${row.id} (${row.type}) agotó ${MAX_ATTEMPTS} intentos: requiere revisión`,
              );
            result.failed++;
          }
        }
        return result;
      },
      { timeout: 30_000 },
    );
  }
}
