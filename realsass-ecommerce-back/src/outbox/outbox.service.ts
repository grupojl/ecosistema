import { Injectable } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma';
import type { PrismaTransactionClient } from '@/prisma/prisma.service';
import type { OutboxEventInput } from '@/outbox/outbox.types';

/**
 * OutboxService — escribe el evento en la MISMA transacción que el cambio de negocio (ADR-029).
 * Si la transacción se revierte, el evento tampoco existe; si se confirma, el evento está garantizado en la tabla
 * aunque el proceso caiga justo después (el relay lo publica cuando vuelva).
 *
 * Apagado por defecto (OUTBOX_ENABLED=true lo activa): hasta aplicar la migración 20261030150000_outbox_events
 * la tabla no existe y escribir en ella rompería el checkout.
 */
@Injectable()
export class OutboxService {
  get enabled(): boolean {
    return process.env['OUTBOX_ENABLED'] === 'true';
  }

  async enqueue(
    tx: PrismaTransactionClient,
    event: OutboxEventInput,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        organizationId: event.organizationId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        type: event.type,
        payload: event.payload as Prisma.InputJsonValue,
      },
    });
  }
}
