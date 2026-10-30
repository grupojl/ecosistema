/** Contratos del Transactional Outbox (ADR-029). */
export interface OutboxEventInput {
  organizationId: string;
  aggregateType: string; // 'Order'
  aggregateId: string;
  type: string; // 'order.created'
  payload: Record<string, unknown>; // sin datos personales: los consumidores consultan por id
}

export interface OutboxEventRecord extends OutboxEventInput {
  id: string; // clave de idempotencia para los consumidores (entrega at-least-once)
  attempts: number;
  createdAt: Date;
}

/** Quien entrega el evento al mundo (cola, webhook, WhatsApp…). Debe lanzar si no pudo entregarlo. */
export interface OutboxPublisher {
  publish(event: OutboxEventRecord): Promise<void>;
}

export const OUTBOX_PUBLISHER = Symbol('OUTBOX_PUBLISHER');
