/**
 * src/trpc/trpc.ts
 *
 * Inicialización del servidor tRPC para real-back.
 *
 * Context:
 *   uid            → firebaseUid del usuario autenticado (string | null)
 *   organizationId → de header x-organization-id (string | null)
 *   role           → resuelto por TenantGuard pre-montado ('OWNER' | 'COLLABORATOR' | null)
 *   req            → Express Request completo (para acceder a req.ip en secrets)
 *
 * Procedures exportados:
 *   publicProcedure  → sin auth (no usada en este back, pero disponible)
 *   authProcedure    → requiere uid (token Firebase válido)
 *   tenantProcedure  → requiere uid + organizationId + role
 *   ownerProcedure   → requiere uid + organizationId + role === 'OWNER'
 */
import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request } from 'express';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface TrpcContext {
  req:            Request;
  uid:            string | null;
  organizationId: string | null;
  role:           'OWNER' | 'COLLABORATOR' | null;
}

export function createTrpcContext({ req }: CreateExpressContextOptions): TrpcContext {
  const user           = (req as any).user  ?? null;
  const tenant         = (req as any).tenant ?? null;
  const organizationId =
    tenant?.organizationId ??
    (req.headers['x-organization-id'] as string | undefined) ??
    null;

  return {
    req,
    uid:            user?.uid   ?? null,
    organizationId,
    role:           tenant?.role ?? null,
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
          error.cause instanceof Error && 'issues' in (error.cause as any)
            ? (error.cause as any).issues
            : null,
      },
    };
  },
});

// ─── Middlewares ──────────────────────────────────────────────────────────────

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token Firebase requerido' });
  }
  return next({ ctx: { ...ctx, uid: ctx.uid } });
});

const enforceTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (!ctx.organizationId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id requerido' });
  }
  if (!ctx.role) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Sin acceso a esta organización' });
  }
  return next({ ctx: { ...ctx, uid: ctx.uid, organizationId: ctx.organizationId, role: ctx.role } });
});

const enforceOwner = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!ctx.organizationId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id requerido' });
  if (ctx.role !== 'OWNER') throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo el OWNER puede realizar esta acción' });
  return next({ ctx: { ...ctx, uid: ctx.uid, organizationId: ctx.organizationId, role: 'OWNER' as const } });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const router           = t.router;
export const publicProcedure  = t.procedure;
export const authProcedure:   any = t.procedure.use(enforceAuth);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tenantProcedure: any = t.procedure.use(enforceTenant);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ownerProcedure:  any = t.procedure.use(enforceOwner);
