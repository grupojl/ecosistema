import { initTRPC, TRPCError } from '@trpc/server';
import type { TRPCProcedureBuilder, TRPCUnsetMarker } from '@trpc/server';
import { ZodError } from 'zod';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?:   { uid: string; email: string; displayName: string | null; avatarUrl: string | null };
  tenant?: { userId: string; organizationId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'; permissions: Record<string, boolean> };
}

export interface TrpcContext {
  req: Request;
  uid: string | null;
  organizationId: string | null;
  role: 'OWNER' | 'COLLABORATOR' | null;
}

// Contextos de salida de cada middleware. Con nombre a propósito: si `next({ ctx: { ...ctx } })`
// infiere el tipo por spread, TS expande `Request` y el .d.ts de los procedures necesita
// nombrar `ParsedQs` (TS2883, no portable) — el contrato para los fronts se perdía en `any`.
export interface AuthedTrpcContext extends TrpcContext {
  uid: string;
}
export interface TenantTrpcContext extends AuthedTrpcContext {
  organizationId: string;
  role: 'OWNER' | 'COLLABORATOR';
}
export interface OwnerTrpcContext extends TenantTrpcContext {
  role: 'OWNER';
}

/** Builder de procedures con `TOverrides` nombrado (ver nota sobre TS2883 arriba). */
type ProcedureWith<TOverrides> = TRPCProcedureBuilder<
  TrpcContext, object, TOverrides,
  TRPCUnsetMarker, TRPCUnsetMarker, TRPCUnsetMarker, TRPCUnsetMarker, false
>;

export function createTrpcContext({ req }: CreateExpressContextOptions): TrpcContext {
  const typedReq      = req as AuthenticatedRequest;
  const user          = typedReq.user  ?? null;
  const tenant        = typedReq.tenant ?? null;
  const organizationId =
    tenant?.organizationId ??
    (req.headers['x-organization-id'] as string | undefined) ??
    null;

  return {
    req,
    uid:            user?.uid   ?? null,
    organizationId,
    role:           (tenant?.role as 'OWNER' | 'COLLABORATOR' | null) ?? null,
  };
}

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.issues : null,
      },
    };
  },
});

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token Firebase requerido' });
  const authed: AuthedTrpcContext = { ...ctx, uid: ctx.uid };
  return next({ ctx: authed });
});

const enforceTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!ctx.organizationId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id requerido' });
  if (!ctx.role) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sin acceso a esta organización' });
  const tenant: TenantTrpcContext = { ...ctx, uid: ctx.uid, organizationId: ctx.organizationId, role: ctx.role };
  return next({ ctx: tenant });
});

const enforceOwner = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!ctx.organizationId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id requerido' });
  if (ctx.role !== 'OWNER') throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo el OWNER puede realizar esta acción' });
  const owner: OwnerTrpcContext = { ...ctx, uid: ctx.uid, organizationId: ctx.organizationId, role: 'OWNER' };
  return next({ ctx: owner });
});

export const router          = t.router;
export const publicProcedure = t.procedure;
export const authProcedure:   ProcedureWith<AuthedTrpcContext> = t.procedure.use(enforceAuth);
export const tenantProcedure: ProcedureWith<TenantTrpcContext> = t.procedure.use(enforceTenant);
export const ownerProcedure:  ProcedureWith<OwnerTrpcContext>  = t.procedure.use(enforceOwner);
