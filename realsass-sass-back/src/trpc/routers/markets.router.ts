import { z }              from 'zod'
import { router, tenantProcedure, ownerProcedure, internalProcedure } from '@/trpc/trpc'
import { MarketsService }          from '@/markets/markets.service'
import { runInTenant }             from '@/prisma/tenant-context'

const FulfillmentConfigInput = z.object({
  provider:     z.string().optional(),
  contactEmail: z.string().email().optional(),
  notes:        z.string().optional(),
  priority:     z.number().int().min(1).default(1),
  shippingCents: z.number().int().min(0).optional(),
})

/**
 * Markets (ADR-014). La organización sale SIEMPRE del contexto autenticado (x-organization-id validado contra la
 * membresía), nunca del input. Antes todos los procedures eran públicos y recibían organizationId/id por input:
 * cualquiera podía crear, cambiar o borrar los mercados de otra organización.
 *
 *   list                         → miembro de la organización
 *   create/update/setDefault/delete → OWNER
 *   resolve                      → solo servicios (x-internal-api-key); lo consume ecommerce-back en el checkout
 */
export function createMarketsRouter(marketsService: MarketsService) {
  return router({
    list: tenantProcedure
      .query(({ ctx }) => marketsService.list(ctx.organizationId)),

    create: ownerProcedure
      .input(z.object({
        countryCode:       z.string().length(2).transform(v => v.toUpperCase()),
        fulfillmentConfig: FulfillmentConfigInput.optional(),
      }))
      .mutation(({ ctx, input }) => marketsService.create({ ...input, organizationId: ctx.organizationId })),

    update: ownerProcedure
      .input(z.object({
        id:                z.string().uuid(),
        isActive:          z.boolean().optional(),
        fulfillmentConfig: FulfillmentConfigInput.optional(),
      }))
      .mutation(({ ctx, input }) => marketsService.update(ctx.organizationId, input.id, {
        isActive:          input.isActive,
        fulfillmentConfig: input.fulfillmentConfig,
      })),

    setDefault: ownerProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => marketsService.setDefault(ctx.organizationId, input.id)),

    delete: ownerProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => marketsService.delete(ctx.organizationId, input.id)),

    // Consumido por ecommerce-back con INTERNAL_API_KEY
    resolve: internalProcedure
      .input(z.object({
        organizationId: z.string().uuid(),
        countryCode:    z.string().length(2).transform(v => v.toUpperCase()),
      }))
      .query(({ input }) =>
        // ADR-027: llamada de servicio, sin sesión de usuario: la organización viene por input y el alcance se abre acá.
        runInTenant(input.organizationId, () => marketsService.resolveMarket(input.organizationId, input.countryCode)),
      ),
  })
}
