// Tipos
export type {
  TenantRole,
  TenantContext,
  CurrentUserPayload,
  OrganizationAccessResult,
} from './types/tenant-context';

// Ports
export { CACHE_PORT }           from './ports/cache.port';
export type { CachePort }       from './ports/cache.port';
export { MemoryCacheAdapter }   from './ports/memory-cache.adapter';

// Firebase
export { FirebaseModule }       from './firebase/firebase.module';

// Guards
export { FirebaseAuthGuard }    from './guards/firebase-auth.guard';
export { RolesGuard }           from './guards/roles.guard';
export { TenantGuard }          from './guards/tenant.guard';

// Decorators
export { CurrentUser }          from './decorators/current-user.decorator';
export { Public,  IS_PUBLIC_KEY } from './decorators/public.decorator';
export { Roles,   ROLES_KEY }   from './decorators/roles.decorator';
export { Tenant }               from './decorators/tenant.decorator';

// Middleware tRPC — Capa 1
export {
  createTrpcAuthMiddleware,
} from './middleware/create-trpc-auth-middleware';
export type {
  TrpcAuthMiddlewareOptions,
  TrpcAuthMiddlewareResult,
} from './middleware/create-trpc-auth-middleware';

// Session — Capa auth cookies HttpOnly (ADR-004)
export { SessionService, AuthSessionController, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_MS } from './session';
export type { SessionCookieOptions, VerifiedSession } from './session';
