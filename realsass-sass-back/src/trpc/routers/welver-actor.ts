import type { TenantTrpcContext } from '@/trpc/trpc';
import type { WelverActor } from '@/welver/welver.types';

/** El actor de los servicios de Welver sale SIEMPRE del contexto validado, nunca del input. */
export const actorOf = (ctx: TenantTrpcContext): WelverActor => ({
  organizationId: ctx.organizationId,
  uid: ctx.uid,
  role: ctx.role,
});
