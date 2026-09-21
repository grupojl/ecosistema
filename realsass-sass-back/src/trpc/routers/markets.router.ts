import { z }              from 'zod'
import { router, publicProcedure } from '@real/trpc'
import { MarketsService }          from '../../markets/markets.service'

const FulfillmentConfigInput = z.object({
  provider:     z.string().optional(),
  contactEmail: z.string().email().optional(),
  notes:        z.string().optional(),
  priority:     z.number().int().min(1).default(1),
})

export function createMarketsRouter(marketsService: MarketsService) {
  return router({
    list: publicProcedure
      .input(z.object({ organizationId: z.string().uuid() }))
      .query(({ input }) => marketsService.list(input.organizationId)),

    create: publicProcedure
      .input(z.object({
        organizationId:    z.string().uuid(),
        countryCode:       z.string().length(2).transform(v => v.toUpperCase()),
        fulfillmentConfig: FulfillmentConfigInput.optional(),
      }))
      .mutation(({ input }) => marketsService.create(input)),

    update: publicProcedure
      .input(z.object({
        id:                z.string().uuid(),
        isActive:          z.boolean().optional(),
        fulfillmentConfig: FulfillmentConfigInput.optional(),
      }))
      .mutation(({ input }) => marketsService.update(input.id, {
        isActive:          input.isActive,
        fulfillmentConfig: input.fulfillmentConfig,
      })),

    setDefault: publicProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input }) => marketsService.setDefault(input.id)),

    delete: publicProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input }) => marketsService.delete(input.id)),

    // Consumido por ecommerce-back con INTERNAL_API_KEY
    resolve: publicProcedure
      .input(z.object({
        organizationId: z.string().uuid(),
        countryCode:    z.string().length(2).transform(v => v.toUpperCase()),
      }))
      .query(({ input }) =>
        marketsService.resolveMarket(input.organizationId, input.countryCode)
      ),
  })
}
