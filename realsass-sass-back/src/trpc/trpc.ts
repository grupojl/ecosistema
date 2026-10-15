import { initTRPC, TRPCError } from '@trpc/server';
import type { TRPCProcedureBuilder, TRPCUnsetMarker } from '@trpc/server';
import { ZodError } from 'zod';
import { HttpException } from '@nestjs/common';
import { identifyCaller } from '@real/auth-server';
import { isUuid, runInTenant } from '@/prisma/tenant-context';
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
    // En producción un error inesperado (INTERNAL_SERVER_ERROR) no expone su mensaje: puede traer
    // detalles de Prisma, rutas o SQL. El detalle queda en el log del servidor. Las excepciones de
    // negocio ya se tradujeron a su código (mapNestErrors) y conservan su mensaje.
    const hideMessage = process.env.NODE_ENV === 'production' && shape.data.code === 'INTERNAL_SERVER_ERROR';
    return {
      ...shape,
      message: hideMessage ? 'Error interno del servidor' : shape.message,
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
      message: Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : cause.message,
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

/**
 * Llamadas servicio a servicio (p. ej. ecommerce-back resolviendo el Market). Exige x-internal-api-key válida, con la
 * misma comparación en tiempo constante y rotación que los endpoints /internal/*. Antes markets.resolve era público y
 * el header que mandaba ecommerce-back nadie lo validaba.
 */
const enforceInternalCaller = t.middleware(({ ctx, next }) => {
  const expected = process.env['INTERNAL_API_KEY'];
  const header   = ctx.req.headers['x-internal-api-key'];
  const key      = typeof header === 'string' ? header : undefined;
  if (!expected || !identifyCaller(key, expected)) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Clave de servicio inválida' });
  }
  return next();
});

/**
 * ADR-027 — Row Level Security. Una vez autorizada la petición (la organización ya está validada contra la membresía),
 * todo lo que el handler consulte ve SOLO las filas de esa organización, aunque una consulta se olvide del `where`.
 * Va DESPUÉS de enforceTenant / enforceOwner: nunca abre un alcance con una organización sin validar.
 */
const withTenantScope = t.middleware(({ ctx, next }) => {
  const organizationId = ctx.organizationId;
  if (!organizationId || !isUuid(organizationId)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id inválido' });
  }
  return runInTenant(organizationId, () => next());
});

export const router          = t.router;
export const publicProcedure = t.procedure.use(mapNestErrors);
export const authProcedure:   ProcedureWith<AuthedTrpcContext> = t.procedure.use(mapNestErrors).use(enforceAuth);
export const tenantProcedure: ProcedureWith<TenantTrpcContext> = t.procedure.use(mapNestErrors).use(enforceTenant).use(withTenantScope);
export const ownerProcedure:  ProcedureWith<OwnerTrpcContext>  = t.procedure.use(mapNestErrors).use(enforceOwner).use(withTenantScope);
export const internalProcedure = t.procedure.use(mapNestErrors).use(enforceInternalCaller);
