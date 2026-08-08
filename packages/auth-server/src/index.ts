// Tipos
export type {
  TenantContext, CurrentUserPayload,
  OrganizationAccessResult, TenantRole,
} from './types/tenant-context';

// Ports
export { CACHE_PORT }          from './ports/cache.port';
export type { CachePort }      from './ports/cache.port';
export { MemoryCacheAdapter }  from './ports/memory-cache.adapter';

// Firebase
export { FirebaseModule }      from './firebase/firebase.module';

// Guards
export { FirebaseAuthGuard }   from './guards/firebase-auth.guard';
export { TenantGuard }         from './guards/tenant.guard';
export { RolesGuard }          from './guards/roles.guard';

// Decorators
export { Public, IS_PUBLIC_KEY } from './decorators/public.decorator';
export { Roles, ROLES_KEY }      from './decorators/roles.decorator';
export { CurrentUser }           from './decorators/current-user.decorator';
export { Tenant }                from './decorators/tenant.decorator';
