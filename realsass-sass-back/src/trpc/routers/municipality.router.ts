/**
 * municipality.router.ts — `municipio.*` y `suscripcion.*` (welver-domain.md §15.3).
 *
 * Municipio: cualquier miembro lee; el dueño edita. Suscripción: cualquier miembro ve el estado (para el aviso de
 * vencimiento); el dueño contrata y ve las facturas. Las operaciones de la plataforma (verificar un pago, fijar el tope
 * de mensajes, sincronizar vencimientos) son servicio-a-servicio con la clave interna, no de sesión.
 */
import { z } from 'zod';
import {
  router,
  tenantProcedure,
  ownerProcedure,
  internalProcedure,
} from '@/trpc/trpc';
import type { MunicipalityService } from '@/welver/municipality/municipality.service';
import type { SubscriptionService } from '@/welver/subscription/subscription.service';
import {
  CreateSubscriptionSchema,
  InternalMarkPaidSchema,
  InternalMessageCapSchema,
  UpdateMunicipalitySchema,
} from '@/welver/welver.schemas';

export function createMunicipalityRouter(municipality: MunicipalityService) {
  return router({
    get: tenantProcedure.query(({ ctx }) =>
      municipality.get(ctx.organizationId),
    ),

    update: ownerProcedure
      .input(UpdateMunicipalitySchema)
      .mutation(({ ctx, input }) =>
        municipality.update(ctx.organizationId, ctx.uid, input),
      ),
  });
}

export function createSubscriptionRouter(subscriptions: SubscriptionService) {
  return router({
    get: tenantProcedure.query(({ ctx }) =>
      subscriptions.get(ctx.organizationId),
    ),

    create: ownerProcedure
      .input(CreateSubscriptionSchema)
      .mutation(({ ctx, input }) =>
        subscriptions.create(ctx.organizationId, ctx.uid, input),
      ),

    invoices: ownerProcedure.query(({ ctx }) =>
      subscriptions.invoices(ctx.organizationId),
    ),

    // ── Plataforma (x-internal-api-key) ──────────────────────────────────────
    internalMarkPaid: internalProcedure
      .input(InternalMarkPaidSchema)
      .mutation(({ input }) =>
        subscriptions.markInvoicePaid(
          input.organizationId,
          input.invoiceId,
          input.markedBy,
          input.reference,
        ),
      ),

    internalSetMessageCap: internalProcedure
      .input(InternalMessageCapSchema)
      .mutation(({ input }) =>
        subscriptions.setMessageCap(input.organizationId, input.cap, input.by),
      ),

    internalSync: internalProcedure
      .input(z.object({}).optional())
      .mutation(() => subscriptions.syncStatuses()),
  });
}
