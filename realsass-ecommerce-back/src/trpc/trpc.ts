import { headerOf, messageOf } from '@/http/request';
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
import { HttpException } from '@nestjs/common';
import type { TRPCProcedureBuilder, TRPCUnsetMarker } from '@trpc/server';
import { ZodError } from 'zod';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request } from 'express';

// ─── Context unificado ────────────────────────────────────────────────────────

export interface TrpcContext {
  req: Request;
  // Admin
  uid: string | null;
  organizationId: string | null;
  role: 'OWNER' | 'COLLABORATOR' | null;
  userId: string | null; // id interno (real-back), resuelto por TenantGuard
  // Customer (ADR-021): se deriva del token de Firebase verificado + x-organization-id; nunca de un header.
  customerId: string | null;
  resolveCustomerId: () => Promise<string | null>;
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
  TrpcContext,
  object,
  TOverrides,
  TRPCUnsetMarker,
  TRPCUnsetMarker,
  TRPCUnsetMarker,
  TRPCUnsetMarker,
  false
>;

/** Resuelve (y crea, la primera vez) el cliente de una organización a partir del usuario verificado de la request. */
export type CustomerResolver = (
  req: Request,
  organizationId: string | null,
) => Promise<string | null>;

export const noCustomer: CustomerResolver = async () => null;

export function makeTrpcContext(resolveCustomer: CustomerResolver) {
  return (opts: CreateExpressContextOptions): TrpcContext =>
    createTrpcContext(opts, resolveCustomer);
}

export function createTrpcContext(
  { req }: CreateExpressContextOptions,
  resolveCustomer: CustomerResolver = noCustomer,
): TrpcContext {
  const user = req.user ?? null;
  const tenant = req.tenant ?? null;
  const organizationId =
    tenant?.organizationId ?? headerOf(req, 'x-organization-id') ?? null;

  return {
    req,
    uid: user?.uid ?? null,
    organizationId,
    // El panel distingue dueño de colaborador; ADMIN/MEMBER/VIEWER de la organización son colaboradores.
    role: tenant ? (tenant.role === 'OWNER' ? 'OWNER' : 'COLLABORATOR') : null,
    userId: tenant?.userId ?? null,
    customerId: null,
    resolveCustomerId: memoizeOnce(() => resolveCustomer(req, organizationId)),
  };
}

function memoizeOnce<T>(fn: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | undefined;
  return () => (cached ??= fn());
}

// ─── Init ─────────────────────────────────────────────────────────────────────

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

// ─── Middlewares ──────────────────────────────────────────────────────────────

function statusToTrpcCode(status: number): TRPCError['code'] {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

/**
 * Las excepciones de Nest que lanzan los services (NotFound, Conflict, InsufficientStock…) llegaban al front como
 * INTERNAL_SERVER_ERROR (HTTP 500). El storefront depende de NOT_FOUND para responder 404 (SEO: un 5xx no desindexa
 * pero tampoco es una página inexistente) y de CONFLICT para avisar «sin stock». Misma traducción que sass-back.
 */
const mapNestErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (
    !result.ok &&
    result.error.code === 'INTERNAL_SERVER_ERROR' &&
    result.error.cause instanceof HttpException
  ) {
    const cause = result.error.cause;
    const body = cause.getResponse();
    const raw = messageOf(body) ?? cause.message;
    throw new TRPCError({
      code: statusToTrpcCode(cause.getStatus()),
      message: Array.isArray(raw) ? raw.join(', ') : String(raw ?? cause.message),
      cause,
    });
  }
  return result;
});

/** Admin autenticado (OWNER o COLLABORATOR) */
const enforceAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.uid)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Token Firebase requerido',
    });
  if (!ctx.organizationId)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Header x-organization-id requerido',
    });
  if (!ctx.role)
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Sin acceso a esta organización',
    });
  const admin: AdminTrpcContext = {
    ...ctx,
    uid: ctx.uid,
    organizationId: ctx.organizationId,
    role: ctx.role,
  };
  return next({ ctx: admin });
});

/** Solo OWNER */
const enforceOwnerOnly = t.middleware(({ ctx, next }) => {
  if (!ctx.uid) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!ctx.organizationId)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Header x-organization-id requerido',
    });
  if (ctx.role !== 'OWNER')
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Solo el OWNER puede realizar esta acción',
    });
  const owner: OwnerOnlyTrpcContext = {
    ...ctx,
    uid: ctx.uid,
    organizationId: ctx.organizationId,
    role: 'OWNER',
  };
  return next({ ctx: owner });
});

/** Cliente del storefront: sesión de Firebase verificada (email verificado) dentro de la organización del header (ADR-021). */
const enforceCustomer = t.middleware(async ({ ctx, next }) => {
  if (!ctx.organizationId)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Header x-organization-id requerido',
    });
  const customerId = await ctx.resolveCustomerId();
  if (!customerId)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Iniciá sesión con tu cuenta (email verificado) para continuar',
    });
  const customer: CustomerTrpcContext = {
    ...ctx,
    customerId,
    organizationId: ctx.organizationId,
  };
  return next({ ctx: customer });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const { router } = t;
export const publicProcedure = t.procedure.use(mapNestErrors);

export const adminProcedure: ProcedureWith<AdminTrpcContext> =
  t.procedure.use(mapNestErrors).use(enforceAdmin);
export const ownerOnlyProcedure: ProcedureWith<OwnerOnlyTrpcContext> =
  t.procedure.use(mapNestErrors).use(enforceOwnerOnly);
export const customerProcedure: ProcedureWith<CustomerTrpcContext> =
  t.procedure.use(mapNestErrors).use(enforceCustomer);
