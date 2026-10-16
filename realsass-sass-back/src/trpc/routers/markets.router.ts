import { z }              from 'zod'
import { TRPCError }      from '@trpc/server'
import { router, tenantProcedure, ownerProcedure, internalProcedure } from '@/trpc/trpc'
import { MarketsService }          from '@/markets/markets.service'

const FulfillmentConfigInput = z.object({
  provider:     z.string().optional(),
  contactEmail: z.string().email().optional(),
  notes:        z.string().optional(),
  priority:     z.number().int().min(1).default(1),
})

/**
 * Markets (ADR-014). Antes TODAS las operaciones eran `publicProcedure`: cualquiera, sin sesión, podía crear, cambiar o
 * borrar mercados de cualquier tienda (el organizationId es público: lo devuelve el endpoint de tienda por slug).
 *
 *   list                             → miembro de la organización activa
 *   create / update / setDefault / delete → solo el dueño, y solo sobre SU organización
 *   resolve                          → solo servicio-a-servicio (INTERNAL_API_KEY), lo usa ecommerce-back en el checkout
 *
 * La organización sale del header x-organization-id ya validado contra la base (ctx), nunca del input: si el input trae
 * otra, es FORBIDDEN.
 */
function assertSameOrg(ctxOrg: string, inputOrg: string | undefined): void {
  if (inputOrg !== undefined && inputOrg !== ctxOrg) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'La organización no coincide con la activa' })
  }
}

export function createMarketsRouter(marketsService: MarketsService) {
  return router({
    list: tenantProcedure
      .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
      .query(({ ctx, input }) => {
        assertSameOrg(ctx.organizationId, input?.organizationId)
        return marketsService.list(ctx.organizationId)
      }),

    create: ownerProcedure
      .input(z.object({
        organizationId:    z.string().uuid().optional(),
        countryCode:       z.string().length(2).transform(v => v.toUpperCase()),
        fulfillmentConfig: FulfillmentConfigInput.optional(),
      }))
      .mutation(({ ctx, input }) => {
        assertSameOrg(ctx.organizationId, input.organizationId)
        return marketsService.create({
          organizationId:    ctx.organizationId,
          countryCode:       input.countryCode,
          fulfillmentConfig: input.fulfillmentConfig,
        })
      }),

    update: ownerProcedure
      .input(z.object({
        id:                z.string().uuid(),
        isActive:          z.boolean().optional(),
        fulfillmentConfig: FulfillmentConfigInput.optional(),
      }))
      .mutation(({ ctx, input }) => marketsService.update(input.id, {
        isActive:          input.isActive,
        fulfillmentConfig: input.fulfillmentConfig,
      }, ctx.organizationId)),

    setDefault: ownerProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => marketsService.setDefault(input.id, ctx.organizationId)),

    delete: ownerProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => marketsService.delete(input.id, ctx.organizationId)),

    // Servicio-a-servicio: ecommerce-back manda x-internal-api-key (ver OrganizationsClientService.resolveMarket)
    resolve: internalProcedure
      .input(z.object({
        organizationId: z.string().uuid(),
        countryCode:    z.string().length(2).transform(v => v.toUpperCase()),
      }))
      .query(({ input }) =>
        marketsService.resolveMarket(input.organizationId, input.countryCode)
      ),
  })
}
