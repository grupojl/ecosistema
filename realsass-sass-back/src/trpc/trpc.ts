import { initTRPC, TRPCError } from '@trpc/server';
import type { TRPCProcedureBuilder, TRPCUnsetMarker } from '@trpc/server';
import { ZodError } from 'zod';
import { HttpException } from '@nestjs/common';
import { AppCodeError, type AppCode } from '@/trpc/app-code-error';
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

/** HTTP status de una excepción de Nest → código tRPC (catálogo de errores del flow del dueño, §4.1). */
function statusToTrpcCode(status: number): TRPCError['code'] {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 429: return 'TOO_MANY_REQUESTS';
    default:  return 'INTERNAL_SERVER_ERROR';
  }
}

/** Código estable para la UI, independiente del texto del mensaje. */
function appCodeOf(error: TRPCError): AppCode | null {
  const cause = error.cause;
  if (cause instanceof AppCodeError) return cause.appCode;
  if (cause instanceof HttpException) {
    const body = cause.getResponse();
    if (typeof body === 'object' && body !== null && 'error' in body && body.error === 'Quota Exceeded') {
      return 'QUOTA_EXCEEDED';
    }
  }
  return null;
}

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    const body  = cause instanceof HttpException ? cause.getResponse() : null;
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: cause instanceof ZodError ? cause.issues : null,
        // Código estable de la UI + datos de cuota (resource/limit/current) cuando aplica.
        appCode:  appCodeOf(error),
        quota:    typeof body === 'object' && body !== null && 'resource' in body
          ? { resource: String(body.resource), limit: Number((body as { limit?: unknown }).limit ?? 0), current: Number((body as { current?: unknown }).current ?? 0) }
          : null,
      },
    };
  },
});

/**
 * Las excepciones de Nest que lanzan los services (NotFound, Forbidden, Conflict, QuotaExceeded…)
 * llegaban al front como INTERNAL_SERVER_ERROR. Acá se traducen al código tRPC que corresponde.
 */
const mapNestErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.code === 'INTERNAL_SERVER_ERROR' && result.error.cause instanceof HttpException) {
    const cause = result.error.cause;
    const body  = cause.getResponse();
    const raw   = typeof body === 'object' && body !== null && 'message' in body ? (body as { message?: unknown }).message : cause.message;
    throw new TRPCError({
      code:    statusToTrpcCode(cause.getStatus()),
      message: Array.isArray(raw) ? raw.join(', ') : String(raw ?? cause.message),
      cause,
    });
  }
  return result;
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
export const publicProcedure = t.procedure.use(mapNestErrors);
export const authProcedure:   ProcedureWith<AuthedTrpcContext> = t.procedure.use(mapNestErrors).use(enforceAuth);
export const tenantProcedure: ProcedureWith<TenantTrpcContext> = t.procedure.use(mapNestErrors).use(enforceTenant);
export const ownerProcedure:  ProcedureWith<OwnerTrpcContext>  = t.procedure.use(mapNestErrors).use(enforceOwner);
