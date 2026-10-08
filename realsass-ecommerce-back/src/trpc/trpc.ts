import type { TenantRole } from '@real/auth-server';
/**
 * src/trpc/trpc.ts — realsass-ecommerce-back
 *
 * Dos contextos independientes:
 *
 * AdminContext (OWNER/COLLABORATOR del dashboard):
 *   uid            → firebaseUid verificado
 *   organizationId → de header x-organization-id
 *   role           → resuelto por applyTenantContext (llama a OrganizationsClientService)
 *   userId         → id interno del User en real-back
 *
 * CustomerContext (cliente del storefront logueado):
 *   customerId     → de header x-customer-id (seteado tras identify())
 *   organizationId → de header x-organization-id (org del storefront que visita)
 *
 * Procedures exportados:
 *   publicProcedure    → sin auth
 *   adminProcedure     → requiere uid + organizationId + role (OWNER o COLLABORATOR)
 *   ownerOnlyProcedure → requiere uid + organizationId + role === 'OWNER'
 *   customerProcedure  → requiere customerId + organizationId
 */
import { initTRPC, TRPCError } from '@trpc/server';
import type { TRPCProcedureBuilder, TRPCUnsetMarker } from '@trpc/server';
import { ZodError } from 'zod';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request } from 'express';

// Extiende Request con los campos que inyectan los middlewares de auth
interface AuthenticatedRequest extends Request {
  user?:   { uid: string; email: string; displayName: string | null; avatarUrl: string | null };
  tenant?: { userId: string; organizationId: string; role: TenantRole; permissions: Record<string, boolean> };
}

// ─── Context unificado ────────────────────────────────────────────────────────

export interface TrpcContext {
  req:            Request;
  // Admin
  uid:            string | null;
  organizationId: string | null;
  role:           'OWNER' | 'COLLABORATOR' | null;
  userId:         string | null;   // id interno (real-back), resuelto por TenantGuard
  // Customer
  customerId:     string | null;
}

// Contextos de salida de cada middleware. Con nombre a propósito: si `next({ ctx: { ...ctx } })`
// infiere el tipo por spread, TS expande `Request` y el .d.ts de los procedures necesita
// nombrar `ParsedQs` (TS2883, no portable) — el contrato para los fronts se perdía en `any`.
export interface AdminTrpcContext extends TrpcContext {
  uid: string;
  organizationId: string;
  role: 'OWNER' | 'COLLABORATOR';
}
export interface OwnerOnlyTrpcContext extends AdminTrpcContext {
  role: 'OWNER';
}
export interface CustomerTrpcContext extends TrpcContext {
  customerId: string;
  organizationId: string;
}

/** Builder de procedures con `TOverrides` nombrado (ver nota sobre TS2883 arriba). */
type ProcedureWith<TOverrides> = TRPCProcedureBuilder<
  TrpcContext, object, TOverrides,
  TRPCUnsetMarker, TRPCUnsetMarker, TRPCUnsetMarker, TRPCUnsetMarker, false
>;

export function createTrpcContext({ req }: CreateExpressContextOptions): TrpcContext {
  const typedReq       = req as AuthenticatedRequest;
  const user           = typedReq.user   ?? null;
  const tenant         = typedReq.tenant ?? null;
  const organizationId =
    tenant?.organizationId ??
    (req.headers['x-organization-id'] as string | undefined) ??
    null;

  return {
    req,
    uid:            user?.uid         ?? null,
    organizationId,
    role:           (tenant?.role as 'OWNER' | 'COLLABORATOR' | null) ?? null,
    userId:         tenant?.userId    ?? null,
    customerId:     (req.headers['x-customer-id'] as string | undefined) ?? null,
  };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? error.cause.issues
            : null,
      },
    };
  },
});

// ─── Middlewares ──────────────────────────────────────────────────────────────

/** Admin autenticado (OWNER o COLLABORATOR) */
const enforceAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token Firebase requerido' });
  if (!ctx.organizationId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id requerido' });
  if (!ctx.role) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sin acceso a esta organización' });
  const admin: AdminTrpcContext = { ...ctx, uid: ctx.uid, organizationId: ctx.organizationId, role: ctx.role };
  return next({ ctx: admin });
});

/** Solo OWNER */
const enforceOwnerOnly = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!ctx.organizationId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id requerido' });
  if (ctx.role !== 'OWNER') throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo el OWNER puede realizar esta acción' });
  const owner: OwnerOnlyTrpcContext = { ...ctx, uid: ctx.uid, organizationId: ctx.organizationId, role: 'OWNER' };
  return next({ ctx: owner });
});

/** Cliente del storefront logueado (customerId en header) */
const enforceCustomer = t.middleware(({ ctx, next }) => {
  if (!ctx.customerId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Header x-customer-id requerido' });
  if (!ctx.organizationId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id requerido' });
  const customer: CustomerTrpcContext = { ...ctx, customerId: ctx.customerId, organizationId: ctx.organizationId };
  return next({ ctx: customer });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const { router, procedure: publicProcedure } = t;

export const adminProcedure:     ProcedureWith<AdminTrpcContext> = t.procedure.use(enforceAdmin);
export const ownerOnlyProcedure: ProcedureWith<OwnerOnlyTrpcContext> = t.procedure.use(enforceOwnerOnly);
export const customerProcedure:  ProcedureWith<CustomerTrpcContext> = t.procedure.use(enforceCustomer);
