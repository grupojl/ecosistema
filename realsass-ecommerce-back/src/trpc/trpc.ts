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
import { ZodError } from 'zod';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request } from 'express';

// Extiende Request con los campos que inyectan los middlewares de auth
interface AuthenticatedRequest extends Request {
  user?:   { uid: string; email?: string };
  tenant?: { organizationId: string; role: string; userId?: string };
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
    role:           tenant?.role      ?? null,
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
  return next({ ctx: { ...ctx, uid: ctx.uid, organizationId: ctx.organizationId, role: ctx.role } });
});

/** Solo OWNER */
const enforceOwnerOnly = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!ctx.organizationId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id requerido' });
  if (ctx.role !== 'OWNER') throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo el OWNER puede realizar esta acción' });
  return next({ ctx: { ...ctx, uid: ctx.uid, organizationId: ctx.organizationId, role: 'OWNER' as const } });
});

/** Cliente del storefront logueado (customerId en header) */
const enforceCustomer = t.middleware(({ ctx, next }) => {
  if (!ctx.customerId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Header x-customer-id requerido' });
  if (!ctx.organizationId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id requerido' });
  return next({ ctx: { ...ctx, customerId: ctx.customerId, organizationId: ctx.organizationId } });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const { router, procedure: publicProcedure } = t;

export const adminProcedure     = t.procedure.use(enforceAdmin);
export const ownerOnlyProcedure = t.procedure.use(enforceOwnerOnly);
export const customerProcedure  = t.procedure.use(enforceCustomer);
