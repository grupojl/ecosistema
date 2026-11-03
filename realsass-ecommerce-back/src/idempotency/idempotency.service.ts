import { createHash } from 'node:crypto';
import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { z } from 'zod';
import { toJsonObject } from '@/common/prisma/json';
import { PrismaService } from '@/prisma/prisma.service';

/** Un claim IN_PROGRESS más viejo que esto se considera abandonado (el proceso murió) y otro intento puede retomarlo. */
export const STALE_CLAIM_MS = 60_000;

/** Huella estable del contenido de una petición: detecta una clave reutilizada con otro cuerpo. */
export function requestHash(content: unknown): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

/**
 * Idempotencia de operaciones con efectos (DT-IDEM-3, ADR-029): confirmar un pago, un cobro.
 *
 * Dentro de (organización, ámbito, clave) la operación corre UNA sola vez:
 *   · 1.ª vez            → se reclama la clave (INSERT … ON CONFLICT DO NOTHING, atómico entre instancias), corre `fn`
 *                          y se guarda la respuesta.
 *   · reintento          → recibe la respuesta guardada, sin volver a ejecutar nada.
 *   · mismo id, otro cuerpo → 422: es un error del cliente, no un reintento.
 *   · en curso           → 409: que reintente en un momento (no se ejecuta en paralelo).
 *   · `fn` falla         → el claim se libera: un reintento posterior puede volver a intentar.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T extends Record<string, unknown>>(
    organizationId: string,
    scope: string,
    key: string,
    hash: string,
    schema: z.ZodType<T>,
    fn: () => Promise<T>,
  ): Promise<{ result: T; replayed: boolean }> {
    const db = this.prisma.forTenant(organizationId);
    const where = { organizationId_scope_key: { organizationId, scope, key } };

    const claimed = await db.idempotencyKey.createMany({
      data: [{ organizationId, scope, key, requestHash: hash }],
      skipDuplicates: true,
    });

    if (claimed.count === 0) {
      const existing = await db.idempotencyKey.findUnique({ where });
      if (!existing) return this.run(organizationId, scope, key, hash, schema, fn); // se liberó entre medio: reintenta el claim
      if (existing.requestHash !== hash) {
        throw new UnprocessableEntityException('La clave de idempotencia ya se usó con un contenido distinto');
      }
      if (existing.status === 'COMPLETED') {
        return { result: schema.parse(existing.response), replayed: true };
      }
      // IN_PROGRESS: ¿hay alguien trabajando de verdad o el claim quedó huérfano?
      const retaken = await db.idempotencyKey.updateMany({
        where: { organizationId, scope, key, status: 'IN_PROGRESS', createdAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
        data: { createdAt: new Date() },
      });
      if (retaken.count === 0) throw new ConflictException('La operación está en curso; reintentá en unos segundos');
    }

    try {
      const result = await fn();
      await db.idempotencyKey.update({
        where,
        data: { status: 'COMPLETED', response: toJsonObject(result), completedAt: new Date() },
      });
      return { result, replayed: false };
    } catch (error) {
      await db.idempotencyKey.deleteMany({ where: { organizationId, scope, key, status: 'IN_PROGRESS' } }).catch(() => undefined);
      throw error;
    }
  }
}
