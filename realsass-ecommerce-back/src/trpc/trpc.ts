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
 * CustomerContext (cliente del storefront):
 *   customerId     → de la sesión FIRMADA (cookie HttpOnly store_session, emitida por customer.identify).
 *                    Nunca de un id que mande el cliente: lo que el cliente puede fabricar no es una credencial.
 *   organizationId → de header x-organization-id; debe coincidir con la org de la sesión
 *
 * Procedures exportados:
 *   publicProcedure    → sin auth
 *   adminProcedure     → requiere uid + organizationId + role (OWNER o COLLABORATOR)
 *   ownerOnlyProcedure → requiere uid + organizationId + role === 'OWNER'
 *   customerProcedure  → requiere sesión válida + organizationId igual al de la sesión
 */
import { initTRPC, TRPCError } from '@trpc/server';
import type { TRPCProcedureBuilder, TRPCUnsetMarker } from '@trpc/server';
import { ZodError } from 'zod';
import { HttpException } from '@nestjs/common';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import { CUSTOMER_SESSION_COOKIE, type CustomerSessionService } from '@/customers/customer-session.service';
import { isUuid, runInTenant } from '@/prisma/tenant-context';

// Extiende Request con los campos que inyectan los middlewares de auth
interface AuthenticatedRequest extends Request {
  user?:   { uid: string; email: string; displayName: string | null; avatarUrl: string | null };
  tenant?: { userId: string; organizationId: string; role: TenantRole; permissions: Record<string, boolean> };
}

// ─── Context unificado ────────────────────────────────────────────────────────

export interface TrpcContext {
  req:            Request;
  res:            Response;   // identify/logout setean la cookie de sesión
  // Admin
  uid:            string | null;
  organizationId: string | null;
  role:           'OWNER' | 'COLLABORATOR' | null;
  userId:         string | null;   // id interno (real-back), resuelto por TenantGuard
  // Customer (solo si el token firmado es válido)
  customerId:     string | null;
  customerOrganizationId: string | null;
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

export function createTrpcContextFactory(sessions: CustomerSessionService) {
  return ({ req, res }: CreateExpressContextOptions): TrpcContext => buildTrpcContext(req, res, sessions);
}

function buildTrpcContext(req: Request, res: Response, sessions: CustomerSessionService): TrpcContext {
  const typedReq       = req as AuthenticatedRequest;
  const user           = typedReq.user   ?? null;
  const tenant         = typedReq.tenant ?? null;
  const organizationId =
    tenant?.organizationId ??
    (req.headers['x-organization-id'] as string | undefined) ??
    null;

  // La credencial viaja SOLO en la cookie HttpOnly (cookie-parser la expone en req.cookies).
  const cookies: unknown = (req as { cookies?: unknown }).cookies;
  const rawToken = typeof cookies === 'object' && cookies !== null
    ? (cookies as Record<string, unknown>)[CUSTOMER_SESSION_COOKIE]
    : undefined;
  const session = sessions.verify(typeof rawToken === 'string' ? rawToken : null);

  return {
    req,
    res,
    uid:            user?.uid         ?? null,
    organizationId,
    role:           (tenant?.role as 'OWNER' | 'COLLABORATOR' | null) ?? null,
    userId:         tenant?.userId    ?? null,
    customerId:     session?.customerId     ?? null,
    customerOrganizationId: session?.organizationId ?? null,
  };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    // En producción un error inesperado no expone su mensaje (puede traer SQL, rutas o detalles de Prisma).
    const hideMessage = process.env['NODE_ENV'] === 'production' && shape.data.code === 'INTERNAL_SERVER_ERROR';
    return {
      ...shape,
      message: hideMessage ? 'Error interno del servidor' : shape.message,
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

/** HTTP status de una excepción de Nest → código tRPC. */
function statusToTrpcCode(status: number): TRPCError['code'] {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE_CONTENT';
    case 429: return 'TOO_MANY_REQUESTS';
    case 503: return 'SERVICE_UNAVAILABLE';
    default:  return 'INTERNAL_SERVER_ERROR';
  }
}

/**
 * Los services lanzan excepciones de Nest (NotFound, Conflict, UnprocessableEntity…) y tRPC convierte
 * CUALQUIER excepción que no sea TRPCError en INTERNAL_SERVER_ERROR: el storefront recibía un 500 (con el
 * mensaje oculto en producción) donde correspondía un 404 / 409 / 422. Acá se traducen a su código.
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

/** Cliente del storefront con sesión firmada válida, y solo dentro de la organización de esa sesión. */
const enforceCustomer = t.middleware(({ ctx, next }) => {
  if (!ctx.customerId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sesión de cliente requerida' });
  if (!ctx.organizationId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id requerido' });
  // Un token emitido para la tienda A no sirve en la tienda B.
  if (ctx.customerOrganizationId !== ctx.organizationId) throw new TRPCError({ code: 'FORBIDDEN', message: 'La sesión no corresponde a esta tienda' });
  const customer: CustomerTrpcContext = { ...ctx, customerId: ctx.customerId, organizationId: ctx.organizationId };
  return next({ ctx: customer });
});

/**
 * ADR-027 — Row Level Security. Una vez autorizada la petición (la organización ya está validada contra la membresía
 * o contra la sesión firmada), todo lo que el handler consulte ve SOLO las filas de esa organización, aunque una
 * consulta se olvide del `where`. Va DESPUÉS de enforce*: nunca abre un alcance con una organización sin validar.
 */
const withTenantScope = t.middleware(({ ctx, next }) => {
  const organizationId = ctx.organizationId;
  if (!organizationId || !isUuid(organizationId)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Header x-organization-id inválido' });
  }
  return runInTenant(organizationId, () => next());
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const { router } = t;
export const publicProcedure = t.procedure.use(mapNestErrors);

export const adminProcedure:     ProcedureWith<AdminTrpcContext> = t.procedure.use(mapNestErrors).use(enforceAdmin).use(withTenantScope);
export const ownerOnlyProcedure: ProcedureWith<OwnerOnlyTrpcContext> = t.procedure.use(mapNestErrors).use(enforceOwnerOnly).use(withTenantScope);
export const customerProcedure:  ProcedureWith<CustomerTrpcContext> = t.procedure.use(mapNestErrors).use(enforceCustomer).use(withTenantScope);
