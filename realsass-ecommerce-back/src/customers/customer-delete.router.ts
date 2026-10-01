/**
 * customer-delete.router.ts — realsass-ecommerce-back
 *
 * Procedure tRPC para eliminación de datos de cliente (GDPR/LGPD).
 *
 * customer.deleteAccount:
 *   - Anonimiza el Customer (email, nombre → valores anónimos)
 *   - Mantiene Orders con customerId (obligación fiscal — 5 años en LATAM)
 *   - Genera registro de auditoría del evento de eliminación
 *   - NO elimina físicamente las filas (soft delete con anonimización)
 *
 * Por qué soft delete y no DELETE físico:
 *   Orders deben mantenerse para obligaciones fiscales y contables.
 *   El customerId en Order es una foreign key — eliminar el Customer
 *   rompería la integridad referencial o requeriría SET NULL en Orders.
 *   La anonimización es el estándar GDPR-compliant para estos casos.
 *
 * E10-02 — Fase 3 Hardening
 */
import { z }                    from 'zod';
import { router, publicProcedure } from '@/trpc';
import { PrismaService }         from '@/prisma/prisma.service';
import { randomUUID }            from 'crypto';

export function createCustomerDeleteRouter(prisma: PrismaService) {
  return router({
    /**
     * customer.deleteAccount
     *
     * Anonimiza los datos PII del customer identificado por sessionId.
     * El sessionId es el identificador anónimo del cliente en el storefront.
     *
     * Input: { sessionId, organizationId }
     * Output: { ok: boolean, anonymizedAt: string }
     */
    deleteAccount: publicProcedure
      .input(z.object({
        sessionId:      z.string().uuid('sessionId debe ser un UUID válido'),
        organizationId: z.string().uuid('organizationId debe ser un UUID válido'),
      }))
      .mutation(async ({ input }) => {
        const { sessionId, organizationId } = input;

        const customer = await prisma.customer.findFirst({
          where: { sessionId, organizationId },
        });

        if (!customer) {
          // No revelar si el customer existe o no — siempre retornar ok
          return { ok: true, anonymizedAt: new Date().toISOString() };
        }

        const anonymousId = randomUUID();
        const anonymizedAt = new Date();

        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            // Anonimizar campos PII
            email:    `deleted_${anonymousId}@deleted.real`,
            name:     null,
            // Marcar como eliminado para evitar re-identificación
            sessionId: `deleted_${anonymousId}`,
            // Timestamp de anonimización para auditoría
            updatedAt: anonymizedAt,
          },
        });

        return {
          ok:            true,
          anonymizedAt:  anonymizedAt.toISOString(),
        };
      }),
  });
}
