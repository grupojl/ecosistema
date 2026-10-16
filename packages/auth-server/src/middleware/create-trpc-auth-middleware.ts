/**
 * create-trpc-auth-middleware.ts — @real/auth-server
 *
 * Fábrica de middleware Express que centraliza auth para el adapter tRPC.
 * Reemplaza applyFirebaseAuth() + applyTenantContext() duplicadas en cada back.
 *
 * Uso en cualquier trpc.module.ts:
 *
 *   import { createTrpcAuthMiddleware } from '@real/auth-server';
 *
 *   const { firebaseAuth, tenantContext } = createTrpcAuthMiddleware({
 *     getOrganizationAccess: (token, uid, orgId) =>
 *       usersService.getOrganizationAccess(uid, orgId),         // sass-back
 *       // ó
 *       orgsClient.getAccess(token, uid, orgId),                // ecommerce-back
 *   });
 *
 * Contratos:
 *   - firebaseAuth:  verifica Bearer token → inyecta req.user + req.firebaseToken
 *   - tenantContext: lee x-organization-id → llama getOrganizationAccess → inyecta req.tenant
 *   - Token inválido → req.user undefined (enforceAuth lo rechaza)
 *   - Sin x-organization-id → req.tenant undefined (tenantProcedure lo rechaza)
 */

import type { Request, Response, NextFunction } from 'express';
import { getFirebaseAdmin }                      from '@/firebase/firebase.module';
import { SESSION_COOKIE_NAME, SESSION_ID_COOKIE_NAME } from '@/session/session.service';
import type {
  CurrentUserPayload,
  TenantContext,
  OrganizationAccessResult,
} from '@/types/tenant-context';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface TrpcAuthMiddlewareOptions {
  /**
   * Resuelve acceso de un usuario a una organización.
   *
   * Firma unificada: recibe (firebaseToken, firebaseUid, organizationId)
   *
   * - sass-back:      (_, uid, orgId) => UsersService.getOrganizationAccess(uid, orgId)
   * - ecommerce-back: (token, uid, orgId) => OrganizationsClientService.getAccess(token, uid, orgId)
   *
   * El token es el Bearer raw (sin "Bearer ") — disponible porque
   * firebaseAuth corre primero y lo expone en req.firebaseToken.
   */
  getOrganizationAccess: (
    firebaseToken:  string,
    firebaseUid:    string,
    organizationId: string,
  ) => Promise<OrganizationAccessResult>;

  /**
   * ADR-020 (opcional): ¿la sesión `sid` fue cerrada desde la lista de dispositivos?
   * Solo se consulta cuando la request llega por cookie y trae `__sid`. Debe ser barata
   * (cache, sin query por request). Sin esta opción, o sin `__sid` (cookies anteriores
   * a ADR-020), la sesión se acepta hasta que venza.
   */
  isSessionRevoked?: (sessionId: string, firebaseUid: string) => Promise<boolean>;
}

export interface TrpcAuthMiddlewareResult {
  /** Middleware 1: verifica token Firebase → inyecta req.user + req.firebaseToken */
  firebaseAuth:  (req: Request, res: Response, next: NextFunction) => Promise<void>;
  /** Middleware 2: resuelve tenant → inyecta req.tenant */
  tenantContext: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

// ─── Augmentación de Express.Request ─────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?:          CurrentUserPayload;
      tenant?:        TenantContext;
      firebaseToken?: string; // token raw sin "Bearer " — para reenvío HTTP entre backs
    }
  }
}

// ─── Fábrica ──────────────────────────────────────────────────────────────────

export function createTrpcAuthMiddleware(
  options: TrpcAuthMiddlewareOptions,
): TrpcAuthMiddlewareResult {
  const { getOrganizationAccess, isSessionRevoked } = options;

  // ── Middleware 1: Firebase Auth ─────────────────────────────────────────────
  const firebaseAuth = async (
    req:  Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const header = req.headers['authorization'];
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    // ADR-004: sin Bearer, la sesión viaja en la cookie HttpOnly __session.
    const sessionCookie = bearer
      ? undefined
      : (req.cookies as Record<string, string | undefined> | undefined)?.[SESSION_COOKIE_NAME];

    if (!bearer && !sessionCookie) {
      return next();
    }

    try {
      const decoded = bearer
        ? await getFirebaseAdmin().verifyIdToken(bearer)
        : await getFirebaseAdmin().verifySessionCookie(sessionCookie as string, true);

      if (!bearer && isSessionRevoked) {
        const sid = (req.cookies as Record<string, string | undefined> | undefined)?.[SESSION_ID_COOKIE_NAME];
        if (sid && await isSessionRevoked(sid, decoded.uid)) return next(); // sin req.user → UNAUTHORIZED
      }

      // Solo hay token raw para reenviar entre backs cuando llegó por Bearer.
      if (bearer) req.firebaseToken = bearer;
      req.user = {
        uid:         decoded.uid,
        email:       decoded.email        ?? '',
        displayName: decoded.name         ?? null,
        avatarUrl:   decoded.picture      ?? null,
        emailVerified: decoded.email_verified === true,
      } satisfies CurrentUserPayload;
    } catch {
      // Token inválido — enforceAuth rechazará. No cortamos el flujo.
    }

    next();
  };

  // ── Middleware 2: Tenant Context ────────────────────────────────────────────
  const tenantContext = async (
    req:  Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const organizationId = req.headers['x-organization-id'];
    if (!organizationId || typeof organizationId !== 'string') {
      return next();
    }

    const uid   = req.user?.uid;
    const token = req.firebaseToken ?? '';

    if (!uid) {
      return next();
    }

    try {
      const access = await getOrganizationAccess(token, uid, organizationId);

      if (access.canAccess && access.userId && access.role) {
        req.tenant = {
          userId:         access.userId,
          organizationId,
          role:           access.role,
          permissions:    access.permissions ?? {},
        } satisfies TenantContext;
      }
    } catch {
      // Error al resolver tenant — tenantProcedure rechazará con FORBIDDEN.
    }

    next();
  };

  return { firebaseAuth, tenantContext };
}
