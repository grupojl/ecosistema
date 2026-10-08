/**
 * customer-delete.router.ts — realsass-ecommerce-back
 * GDPR/LGPD: anonimización de datos PII del cliente.
 */
import { z }                       from 'zod';
import { router, publicProcedure } from '@/trpc';
import { PrismaService }           from '@/prisma/prisma.service';
import { randomUUID }              from 'crypto';

export function createCustomerDeleteRouter(prisma: PrismaService) {
  return router({
    deleteAccount: publicProcedure
      .input(z.object({
        customerId:     z.string().uuid(),
        organizationId: z.string().uuid(),
      }))
      .mutation(async ({ input }) => {
        const { customerId, organizationId } = input;

        const customer = await prisma.storeCustomer.findFirst({
          where: { id: customerId, organizationId },
        });

        if (!customer) {
          return { ok: true, anonymizedAt: new Date().toISOString() };
        }

        const anonymousId  = randomUUID();
        const anonymizedAt = new Date();

        await prisma.storeCustomer.update({
          where: { id: customer.id },
          data: {
            email:       `deleted_${anonymousId}@deleted.real`,
            displayName: null,
            updatedAt:   anonymizedAt,
          },
        });

        return { ok: true, anonymizedAt: anonymizedAt.toISOString() };
      }),
  });
}
