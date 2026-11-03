import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { IdempotencyService, requestHash } from '@/idempotency/idempotency.service';
import { OutboxService } from '@/outbox/outbox.service';
import { PrismaService } from '@/prisma/prisma.service';
import { runAsTenant } from '@/prisma/tenant-context';

export interface PaymentConfirmation {
  /** Id del evento del proveedor de pagos (único por evento): es la clave de idempotencia. */
  eventId: string;
  paymentIntentId: string;
  /** Monto cobrado. Si viene, DEBE coincidir con el total de la orden: no se marca pagada una orden cobrada de menos. */
  amountCents?: number;
}

const ResultSchema = z.object({
  orderId: z.string(),
  status: z.literal('PAID'),
  /** false cuando la orden ya estaba pagada con ese mismo pago (evento duplicado o tardío). */
  changed: z.boolean(),
});
export type PaymentConfirmationResult = z.infer<typeof ResultSchema>;

export const PAYMENT_EVENT_SCOPE = 'payment-event';

/**
 * Confirmación de pago ENTRANTE (DT-IDEM-3). La invoca quien reciba la notificación del proveedor (pagos-back) y es
 * segura frente a los tres problemas de siempre con webhooks de pago:
 *   · el mismo evento llega dos veces (o a dos instancias a la vez) → se aplica una sola vez;
 *   · llega fuera de orden / tarde → no pisa estados posteriores;
 *   · otro pago llega para una orden ya pagada → NO se acepta en silencio: 409 para que alguien lo reembolse.
 * La transición es un UPDATE condicional (status = 'PENDING_PAYMENT'): no hay "leer y después escribir".
 */
@Injectable()
export class PaymentConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly outbox: OutboxService,
  ) {}

  async confirm(organizationId: string, orderId: string, input: PaymentConfirmation): Promise<PaymentConfirmationResult & { replayed: boolean }> {
    const hash = requestHash({ orderId, paymentIntentId: input.paymentIntentId, amountCents: input.amountCents ?? null });
    const { result, replayed } = await this.idempotency.run(organizationId, PAYMENT_EVENT_SCOPE, input.eventId, hash, ResultSchema, () =>
      this.apply(organizationId, orderId, input),
    );
    return { ...result, replayed };
  }

  private apply(organizationId: string, orderId: string, input: PaymentConfirmation): Promise<PaymentConfirmationResult> {
    return runAsTenant(this.prisma, organizationId, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, organizationId } });
      if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);

      if (input.amountCents !== undefined && input.amountCents !== order.totalCents) {
        throw new ConflictException(`El monto cobrado (${input.amountCents}) no coincide con el total de la orden (${order.totalCents})`);
      }

      // Transición atómica: solo una confirmación concurrente "gana" el cambio de estado.
      const moved = await tx.order.updateMany({
        where: { id: orderId, organizationId, status: 'PENDING_PAYMENT' },
        data: { status: 'PAID', paymentIntentId: input.paymentIntentId },
      });

      if (moved.count === 0) {
        // No estaba pendiente: ¿ya se pagó con ESTE mismo pago (duplicado) o es otra cosa?
        const current = await tx.order.findFirstOrThrow({ where: { id: orderId, organizationId } });
        if (current.status === 'PAID' && current.paymentIntentId === input.paymentIntentId) {
          return { orderId, status: 'PAID' as const, changed: false };
        }
        if (current.status === 'PAID') {
          throw new ConflictException('La orden ya fue pagada con otro pago: hay un cobro duplicado para reembolsar');
        }
        throw new ConflictException(`La orden está ${current.status} y no admite un pago`);
      }

      await tx.orderStatusEvent.create({ data: { orderId, fromStatus: 'PENDING_PAYMENT', toStatus: 'PAID' } });
      if (this.outbox.enabled) {
        await this.outbox.enqueue(tx, {
          organizationId,
          aggregateType: 'Order',
          aggregateId: orderId,
          type: 'order.paid',
          payload: { orderId, totalCents: order.totalCents, currency: order.currency },
        });
      }
      return { orderId, status: 'PAID' as const, changed: true };
    });
  }
}
