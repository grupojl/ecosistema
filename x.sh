#!/usr/bin/env bash
# =============================================================================
# x.sh — SPRINT 1: AUTH REBUILD
# Corre desde la raíz del monorepo (donde está pnpm-workspace.yaml)
#
# QUÉ HACE (en orden estricto):
#   1. Crea packages/auth-server  — guards, decorators, CachePort, FirebaseModule
#   2. Completa packages/auth-client — firebase, apiFetch, AppError, AuthProvider
#   3. Reconstruye src/auth/ y src/users/ en realsass-sass-back
#   4. Reemplaza common/guards y common/decorators en realsass-ecommerce-back
#   5. Reemplaza auth-context y firebase.ts en realsass-sass-front
#   6. Reemplaza auth-context y firebase.ts en realsass-dashboard-front
#   7. Actualiza package.json de cada servicio para consumir los paquetes
#   8. pnpm install desde la raíz
#
# PRE-REQUISITO: haber corrido el x.sh de limpieza anterior
# =============================================================================

set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${BLUE}[->]${NC} $1"; }
ok()   { echo -e "${GREEN}[ok]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; exit 1; }
sep()  { echo -e "${BOLD}----------------------------------------------------${NC}"; }

if [ ! -f "pnpm-workspace.yaml" ]; then
  err "Corre este script desde la raiz del monorepo (donde esta pnpm-workspace.yaml)"
fi

sep
echo -e "${BOLD}  SPRINT 1 - AUTH REBUILD${NC}"
sep


# =============================================================================
# PASO 1 — @real/auth-server
# =============================================================================
sep
log "PASO 1 — Creando packages/auth-server..."

mkdir -p \
  packages/auth-server/src/types \
  packages/auth-server/src/ports \
  packages/auth-server/src/guards \
  packages/auth-server/src/decorators \
  packages/auth-server/src/firebase

cat > packages/auth-server/package.json << 'EOF'
{
  "name": "@real/auth-server",
  "version": "0.0.0",
  "private": true,
  "description": "Guards, decorators, CachePort y FirebaseModule compartidos entre backs NestJS",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "echo \"@real/auth-server ok\"",
    "typecheck": "echo \"@real/auth-server ok\""
  },
  "dependencies": {
    "@nestjs/common": "catalog:",
    "@nestjs/core": "catalog:",
    "firebase-admin": "catalog:",
    "reflect-metadata": "catalog:"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "@types/node": "catalog:"
  },
  "peerDependencies": {
    "@nestjs/common": ">=11.0.0",
    "firebase-admin": ">=13.0.0"
  }
}
EOF
ok "packages/auth-server/package.json"

cat > packages/auth-server/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2023",
    "strict": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "declaration": true,
    "skipLibCheck": true,
    "baseUrl": "."
  },
  "include": ["src/**/*"]
}
EOF
ok "packages/auth-server/tsconfig.json"


cat > packages/auth-server/src/types/tenant-context.ts << 'EOF'
/**
 * TenantRole — jerarquia de roles.
 * DEBE coincidir con el enum MembershipRole del schema.prisma de sass-back.
 * El test de contrato en Sprint 2 lo verifica automaticamente.
 */
export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface TenantContext {
  readonly userId:         string;   // id interno (PK de users), NO el firebaseUid
  readonly organizationId: string;
  readonly role:           TenantRole;
  readonly permissions:    Readonly<Record<string, boolean>>;
}

export interface CurrentUserPayload {
  readonly uid:         string;
  readonly email:       string;
  readonly displayName: string | null;
  readonly avatarUrl:   string | null;
}

export interface OrganizationAccessResult {
  canAccess:       boolean;
  userId?:         string;
  organizationId?: string;
  role?:           TenantRole;
  permissions?:    Record<string, boolean>;
  reason?:         string;
}
EOF
ok "types/tenant-context.ts"

cat > packages/auth-server/src/ports/cache.port.ts << 'EOF'
/**
 * CachePort — abstraccion de cache para TenantGuard.
 *
 * Implementaciones:
 *   MemoryCacheAdapter  — dev y produccion sin Redis (default)
 *   RedisCacheAdapter   — produccion con Redis (Sprint 2, opcional)
 *
 * Registrar en AppModule con:
 *   { provide: CACHE_PORT, useClass: MemoryCacheAdapter }
 */
export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export const CACHE_PORT = Symbol('CACHE_PORT');
EOF
ok "ports/cache.port.ts"

cat > packages/auth-server/src/ports/memory-cache.adapter.ts << 'EOF'
import { Injectable } from '@nestjs/common';
import type { CachePort } from './cache.port';

interface Entry {
  value: unknown;
  exp:   number;
}

/**
 * MemoryCacheAdapter — implementacion en memoria del CachePort.
 * Usar en desarrollo y produccion sin Redis.
 * Limitacion: no se comparte entre instancias del proceso (escala vertical).
 */
@Injectable()
export class MemoryCacheAdapter implements CachePort {
  private readonly store = new Map<string, Entry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, exp: Date.now() + ttlSeconds * 1_000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}
EOF
ok "ports/memory-cache.adapter.ts"


cat > packages/auth-server/src/decorators/public.decorator.ts << 'EOF'
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** @Public() — marca una ruta como publica. FirebaseAuthGuard la deja pasar. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
EOF

cat > packages/auth-server/src/decorators/roles.decorator.ts << 'EOF'
import { SetMetadata } from '@nestjs/common';
import type { TenantRole } from '../types/tenant-context';

export const ROLES_KEY = 'roles';

/** @Roles('OWNER', 'ADMIN') — exige uno de los roles listados. Jerarquia: OWNER > ADMIN > MEMBER > VIEWER. */
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);
EOF

cat > packages/auth-server/src/decorators/current-user.decorator.ts << 'EOF'
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentUserPayload } from '../types/tenant-context';

/** @CurrentUser() — inyecta el payload del usuario autenticado por FirebaseAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUserPayload =>
    ctx.switchToHttp().getRequest().user,
);
EOF

cat > packages/auth-server/src/decorators/tenant.decorator.ts << 'EOF'
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TenantContext } from '../types/tenant-context';

/** @Tenant() — inyecta el TenantContext resuelto por TenantGuard. */
export const Tenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantContext =>
    ctx.switchToHttp().getRequest().tenant,
);
EOF
ok "decorators/ creados"

cat > packages/auth-server/src/firebase/firebase.module.ts << 'EOF'
import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService }                         from '@nestjs/config';
import * as admin                                from 'firebase-admin';

/**
 * FirebaseModule — inicializa Firebase Admin SDK UNA sola vez.
 * @Global() — disponible en toda la app sin importarlo en cada modulo.
 *
 * Variables de entorno requeridas:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (con \\n escapados del .env)
 */
@Global()
@Module({})
export class FirebaseModule implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModule.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (admin.apps.length > 0) return;

    const projectId   = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey  = this.config.get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId) {
      this.logger.warn('FIREBASE_PROJECT_ID no configurado — FirebaseModule deshabilitado');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log(`Firebase Admin inicializado: ${projectId}`);
  }
}
EOF
ok "firebase/firebase.module.ts"


cat > packages/auth-server/src/guards/firebase-auth.guard.ts << 'EOF'
import {
  CanActivate, ExecutionContext, Injectable,
  Logger, UnauthorizedException,
} from '@nestjs/common';
import { Reflector }     from '@nestjs/core';
import * as admin        from 'firebase-admin';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { CurrentUserPayload } from '../types/tenant-context';

/**
 * FirebaseAuthGuard — guard global de autenticacion.
 * Registrar como APP_GUARD en AppModule.
 *
 * 1. Si la ruta tiene @Public() pasa sin verificar.
 * 2. Extrae Bearer token del header Authorization.
 * 3. Verifica con Firebase Admin.
 * 4. Inyecta req.user con CurrentUserPayload.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req   = ctx.switchToHttp().getRequest();
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('Token de autenticacion requerido');
    }

    try {
      const decoded = await admin.app().auth().verifyIdToken(token);

      req.user = {
        uid:         decoded.uid,
        email:       decoded.email ?? '',
        displayName: (decoded['name'] as string | undefined) ?? null,
        avatarUrl:   (decoded['picture'] as string | undefined) ?? null,
      } satisfies CurrentUserPayload;

      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(`Token invalido: ${msg}`);
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }

  private extractToken(req: { headers: Record<string, string | undefined> }): string | undefined {
    const [type, token] = req.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
EOF
ok "guards/firebase-auth.guard.ts"

cat > packages/auth-server/src/guards/tenant.guard.ts << 'EOF'
import {
  CanActivate, ExecutionContext, ForbiddenException,
  Inject, Injectable, Logger, UnauthorizedException,
} from '@nestjs/common';
import { CACHE_PORT }    from '../ports/cache.port';
import type { CachePort } from '../ports/cache.port';
import type { TenantContext, CurrentUserPayload, OrganizationAccessResult } from '../types/tenant-context';

const CACHE_TTL = 90; // segundos — evita hop de red por cada request

/**
 * TenantGuard — resuelve TenantContext para ecommerce-back.
 * Llama a sass-back GET /api/v1/auth/organization-access con cache.
 *
 * En sass-back no uses este guard — el TenantContext se resuelve
 * directamente desde Prisma sin hop de red.
 *
 * Variable de entorno requerida en ecommerce-back:
 *   SASS_BACK_URL=https://tu-sass-back.railway.app
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(@Inject(CACHE_PORT) private readonly cache: CachePort) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req            = ctx.switchToHttp().getRequest();
    const user           = req.user as CurrentUserPayload | undefined;
    const organizationId = req.headers['x-organization-id'] as string | undefined;
    const token          = this.extractToken(req);

    if (!organizationId) throw new ForbiddenException('Header x-organization-id requerido');
    if (!user?.uid)      throw new UnauthorizedException('Usuario no autenticado');
    if (!token)          throw new UnauthorizedException('Bearer token requerido');

    const cacheKey = `org-access:${user.uid}:${organizationId}`;

    const cached = await this.cache.get<TenantContext>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      req.tenant = cached;
      return true;
    }

    const sassBackUrl = process.env['SASS_BACK_URL'];
    if (!sassBackUrl) {
      throw new ForbiddenException('Variable de entorno SASS_BACK_URL no configurada');
    }

    let result: OrganizationAccessResult;
    try {
      const res = await fetch(`${sassBackUrl}/api/v1/auth/organization-access`, {
        headers: {
          'Authorization':     `Bearer ${token}`,
          'x-organization-id': organizationId,
        },
      });
      if (!res.ok) throw new ForbiddenException('Sin acceso a esta organizacion');
      result = await res.json() as OrganizationAccessResult;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`Error en organization-access: ${(error as Error).message}`);
      throw new ForbiddenException('Error al verificar permisos');
    }

    if (!result.canAccess || !result.role || !result.userId) {
      throw new ForbiddenException(result.reason ?? 'Sin acceso a esta organizacion');
    }

    const tenantCtx: TenantContext = {
      userId:         result.userId,
      organizationId: result.organizationId ?? organizationId,
      role:           result.role,
      permissions:    result.permissions ?? {},
    };

    await this.cache.set(cacheKey, tenantCtx, CACHE_TTL);
    req.tenant = tenantCtx;
    return true;
  }

  private extractToken(req: { headers: Record<string, string | undefined> }): string | undefined {
    const [type, token] = req.headers['authorization']?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
EOF
ok "guards/tenant.guard.ts"

cat > packages/auth-server/src/guards/roles.guard.ts << 'EOF'
import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common';
import { Reflector }  from '@nestjs/core';
import { ROLES_KEY }  from '../decorators/roles.decorator';
import type { TenantContext, TenantRole } from '../types/tenant-context';

const HIERARCHY: Record<TenantRole, number> = {
  OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1,
};

/** RolesGuard — aplica RBAC jerarquico. Requiere TenantContext en req.tenant. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TenantRole[]>(ROLES_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const { tenant } = ctx.switchToHttp().getRequest() as { tenant?: TenantContext };
    if (!tenant) {
      throw new ForbiddenException('TenantContext no disponible. Registra TenantGuard antes de RolesGuard.');
    }

    const userLevel = HIERARCHY[tenant.role] ?? 0;
    const minLevel  = Math.min(...required.map(r => HIERARCHY[r] ?? 0));

    if (userLevel < minLevel) {
      throw new ForbiddenException(
        `Rol insuficiente. Requerido: ${required.join(' o ')}. Tu rol: ${tenant.role}`,
      );
    }
    return true;
  }
}
EOF
ok "guards/roles.guard.ts"

cat > packages/auth-server/src/index.ts << 'EOF'
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
EOF
ok "packages/auth-server/src/index.ts"

ok "PASO 1 completo — @real/auth-server"


# =============================================================================
# PASO 2 — @real/auth-client (contenido completo)
# =============================================================================
sep
log "PASO 2 — Completando packages/auth-client..."

mkdir -p \
  packages/auth-client/src/firebase \
  packages/auth-client/src/http \
  packages/auth-client/src/errors \
  packages/auth-client/src/types \
  packages/auth-client/src/react

cat > packages/auth-client/src/errors/app-error.ts << 'EOF'
/** AppErrorCode — codigos tipados de error del ecosistema. */
export type AppErrorCode =
  | 'AUTH'       // 401 — sin sesion o token expirado
  | 'FORBIDDEN'  // 403 — sin permisos
  | 'NOT_FOUND'  // 404
  | 'VALIDATION' // 400
  | 'CONFLICT'   // 409
  | 'RATE_LIMIT' // 429
  | 'SERVER'     // 5xx
  | 'NETWORK';   // fetch fallo sin respuesta

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
EOF
ok "errors/app-error.ts"

cat > packages/auth-client/src/types/index.ts << 'EOF'
/**
 * TenantRole — mismo union que @real/auth-server.
 * Copiado intencionalmente para no crear dependencia server en cliente.
 * Sprint 2: test de contrato verifica que ambos coinciden.
 */
export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface UserProfile {
  id:             string;
  firebaseUid:    string;
  email:          string;
  displayName:    string | null;
  avatarUrl:      string | null;
  isOwner:        boolean;
  isAffiliate:    boolean;
  affiliateCode:  string | null;
  createdAt:      string;
  updatedAt:      string;
  organization:   Organization | null;
  tenants:        Tenant[];
  affiliateData:  AffiliateData | null;
}

export interface Organization {
  id:          string;
  name:        string | null;
  slug:        string | null;
  description: string | null;
  logoUrl:     string | null;
  website:     string | null;
  phone:       string | null;
  address:     string | null;
}

export interface Tenant {
  organizationId: string;
  organization:   Organization;
  role:           TenantRole;
  permissions:    Record<string, boolean>;
}

export interface AffiliateData {
  id:            string;
  balance:       string;
  referralCount: number;
  createdAt:     string;
}

export interface ApiEnvelope<T> {
  success:  boolean;
  data:     T;
  message?: string;
}
EOF
ok "types/index.ts"

cat > packages/auth-client/src/firebase/firebase.ts << 'EOF'
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

export interface FirebaseConfig {
  apiKey:            string;
  authDomain:        string;
  projectId:         string;
  storageBucket:     string;
  messagingSenderId: string;
  appId:             string;
}

let _app: FirebaseApp | null = null;

/** initFirebase — inicializa el SDK una sola vez. Llamar en el layout raiz. */
export function initFirebase(config: FirebaseConfig): FirebaseApp {
  _app = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
  return _app;
}

export function getFirebaseAuth() {
  if (!_app) throw new Error('Firebase no inicializado. Llama a initFirebase() primero.');
  return getAuth(_app);
}

/**
 * getIdToken — obtiene el idToken del usuario actual.
 * @param force true fuerza refresh aunque el token sea valido
 */
export async function getIdToken(force = false): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('No hay usuario autenticado');
  return user.getIdToken(force);
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

export { onAuthStateChanged, type User };
EOF
ok "firebase/firebase.ts"

cat > packages/auth-client/src/http/api-fetch.ts << 'EOF'
import { getIdToken } from '../firebase/firebase';
import { AppError }   from '../errors/app-error';
import type { ApiEnvelope } from '../types/index';

// organizationId activo en memoria — no en localStorage
let _organizationId: string | null = null;

export function setActiveOrganizationId(id: string | null): void {
  _organizationId = id;
}

export function getActiveOrganizationId(): string | null {
  return _organizationId;
}

/**
 * apiFetch<T> — fetch autenticado del ecosistema.
 *
 * - Agrega Authorization: Bearer {idToken} automaticamente.
 * - Agrega x-organization-id si hay una org activa.
 * - En 401 hace force-refresh y reintenta UNA vez.
 * - Lanza AppError tipado.
 *
 * Sprint 2 (fila 2 — cookies HttpOnly):
 *   Agregar credentials: 'include' aqui — sin tocar ningun componente.
 */
export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  return doFetch<T>(url, options, false);
}

async function doFetch<T>(url: string, options: RequestInit, isRetry: boolean): Promise<T> {
  let token: string;
  try {
    token = await getIdToken(isRetry);
  } catch {
    throw new AppError('AUTH', 'No hay sesion activa. Inicia sesion.');
  }

  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (_organizationId) headers['x-organization-id'] = _organizationId;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new AppError('NETWORK', 'Sin conexion al servidor.');
  }

  if (res.status === 401 && !isRetry) return doFetch<T>(url, options, true);
  if (!res.ok) throw await buildAppError(res);

  const envelope = await res.json() as ApiEnvelope<T>;
  return envelope.data ?? (envelope as unknown as T);
}

async function buildAppError(res: Response): Promise<AppError> {
  let body: { message?: string } = {};
  try { body = await res.json(); } catch { /* sin body */ }
  const msg = body.message ?? `Error ${res.status}`;
  switch (res.status) {
    case 400: return new AppError('VALIDATION', msg);
    case 401: return new AppError('AUTH',       msg);
    case 403: return new AppError('FORBIDDEN',  msg);
    case 404: return new AppError('NOT_FOUND',  msg);
    case 409: return new AppError('CONFLICT',   msg);
    case 429: return new AppError('RATE_LIMIT', 'Demasiadas solicitudes. Espera un momento.');
    default:  return new AppError('SERVER',     msg);
  }
}
EOF
ok "http/api-fetch.ts"


cat > packages/auth-client/src/react/auth-provider.tsx << 'EOF'
'use client';

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import {
  getFirebaseAuth, signInWithGoogle, signOut,
  onAuthStateChanged, type User as FirebaseUser,
} from '../firebase/firebase';
import { apiFetch, setActiveOrganizationId } from '../http/api-fetch';
import { AppError }                           from '../errors/app-error';
import type { UserProfile }                   from '../types/index';

interface AuthContextValue {
  user:              UserProfile | null;
  isLoading:         boolean;
  isAuthenticated:   boolean;
  organizationId:    string | null;
  setOrganizationId: (id: string) => void;
  loginWithGoogle:   () => Promise<void>;
  logout:            () => Promise<void>;
  refreshUser:       () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

interface AuthProviderProps {
  children:    ReactNode;
  /** URL base del sass-back, ej: process.env.NEXT_PUBLIC_API_URL */
  sassBackUrl: string;
}

const ORG_KEY = 'real_active_org_id';

async function syncUser(sassBackUrl: string): Promise<UserProfile> {
  return apiFetch<UserProfile>(`${sassBackUrl}/api/v1/auth/sync`, { method: 'POST' });
}

export function AuthProvider({ children, sassBackUrl }: AuthProviderProps) {
  const [user,      setUser]      = useState<UserProfile | null>(null);
  const [orgId,     setOrgId]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer              = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh proactivo a los 55 min (token expira a los 60)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      try {
        const auth = getFirebaseAuth();
        if (auth.currentUser) await auth.currentUser.getIdToken(true);
      } catch { /* usuario cerro sesion */ }
    }, 55 * 60 * 1_000);
  }, []);

  // Restaurar org de sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(ORG_KEY);
    if (stored) {
      setOrgId(stored);
      setActiveOrganizationId(stored);
    }
  }, []);

  // Escuchar cambios de sesion Firebase
  useEffect(() => {
    const auth        = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      try {
        const profile = await syncUser(sassBackUrl);
        setUser(profile);

        // Auto-seleccionar primera org si no hay ninguna activa
        if (!orgId && profile.tenants.length > 0) {
          const firstOrgId = profile.tenants[0]!.organizationId;
          setOrgId(firstOrgId);
          setActiveOrganizationId(firstOrgId);
          sessionStorage.setItem(ORG_KEY, firstOrgId);
        }
        scheduleRefresh();
      } catch (error) {
        if (error instanceof AppError && error.code === 'AUTH') await signOut();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sassBackUrl]);

  const handleSetOrganizationId = useCallback((id: string) => {
    setOrgId(id);
    setActiveOrganizationId(id);
    sessionStorage.setItem(ORG_KEY, id);
  }, []);

  const loginWithGoogle  = useCallback(async () => { await signInWithGoogle(); }, []);

  const logout = useCallback(async () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    await signOut();
    sessionStorage.removeItem(ORG_KEY);
    setActiveOrganizationId(null);
    setUser(null);
    setOrgId(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try { setUser(await syncUser(sassBackUrl)); } catch { /* silencioso */ }
  }, [sassBackUrl]);

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      isAuthenticated:   !!user,
      organizationId:    orgId,
      setOrganizationId: handleSetOrganizationId,
      loginWithGoogle,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
EOF
ok "react/auth-provider.tsx"

cat > packages/auth-client/src/index.ts << 'EOF'
// Errors
export { AppError }       from './errors/app-error';
export type { AppErrorCode } from './errors/app-error';

// Types
export type {
  UserProfile, Organization, Tenant,
  AffiliateData, ApiEnvelope, TenantRole,
} from './types/index';

// Firebase
export {
  initFirebase, getIdToken,
  signInWithGoogle, signOut,
} from './firebase/firebase';
export type { FirebaseConfig } from './firebase/firebase';

// HTTP
export {
  apiFetch,
  setActiveOrganizationId,
  getActiveOrganizationId,
} from './http/api-fetch';

// React
export { AuthProvider, useAuth } from './react/auth-provider';
EOF
ok "packages/auth-client/src/index.ts"

ok "PASO 2 completo — @real/auth-client"


# =============================================================================
# PASO 3 — realsass-sass-back: auth/ y users/ limpios
# =============================================================================
sep
log "PASO 3 — Reconstruyendo realsass-sass-back/src/auth/ y src/users/..."

mkdir -p realsass-sass-back/src/auth realsass-sass-back/src/users

# Agregar @real/auth-server al package.json
node -e "
const fs  = require('fs');
const p   = 'realsass-sass-back/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['@real/auth-server'] = 'workspace:*';
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
console.log('[ok] @real/auth-server agregado a sass-back');
"

cat > realsass-sass-back/src/auth/auth.module.ts << 'EOF'
import { Module }           from '@nestjs/common';
import { AuthController }   from './auth.controller';
import { AuthService }      from './auth.service';
import { UsersModule }      from '../users/users.module';
import { AffiliatesModule } from '../affiliate/affiliate.module';

@Module({
  imports:     [UsersModule, AffiliatesModule],
  controllers: [AuthController],
  providers:   [AuthService],
  exports:     [AuthService],
})
export class AuthModule {}
EOF
ok "auth/auth.module.ts"

cat > realsass-sass-back/src/auth/auth.service.ts << 'EOF'
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as admin            from 'firebase-admin';
import { PrismaService }     from '../prisma/prisma.service';
import { UsersService }      from '../users/users.service';
import { AffiliatesService } from '../affiliate/affiliate.service';
import type { CurrentUserPayload } from '@real/auth-server';

/**
 * AuthService — dos responsabilidades:
 *   1. syncUser()            — upsert del User en DB
 *   2. generateCustomToken() — SSO entre sass-front y dashboard-front
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly users:      UsersService,
    private readonly affiliates: AffiliatesService,
  ) {}

  async syncUser(firebaseUser: CurrentUserPayload, affiliateCode?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: firebaseUser.uid },
    });

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName: firebaseUser.displayName ?? existing.displayName,
          avatarUrl:   firebaseUser.avatarUrl   ?? existing.avatarUrl,
        },
      });
      this.logger.log(`Usuario sincronizado: ${existing.email}`);
      const profile = await this.users.buildProfile(firebaseUser.uid);
      return { isNew: false, user: profile! };
    }

    const newUser = await this.prisma.user.create({
      data: {
        firebaseUid: firebaseUser.uid,
        email:       firebaseUser.email,
        displayName: firebaseUser.displayName,
        avatarUrl:   firebaseUser.avatarUrl,
        isOwner:     false,
        isAffiliate: false,
      },
    });

    this.logger.log(`Nuevo usuario: ${newUser.email}`);

    if (affiliateCode) {
      try {
        await this.affiliates.registerReferral(newUser.id, affiliateCode);
      } catch (err) {
        this.logger.warn(`Error referido ${affiliateCode}: ${(err as Error).message}`);
      }
    }

    const profile = await this.users.buildProfile(firebaseUser.uid);
    return { isNew: true, user: profile! };
  }

  async generateCustomToken(firebaseIdToken: string) {
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.app().auth().verifyIdToken(firebaseIdToken);
    } catch {
      throw new UnauthorizedException('Firebase idToken invalido o expirado');
    }

    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid: decoded.uid },
      include: { organization: true, collaborations: true },
    });

    if (!user) throw new UnauthorizedException('Usuario no registrado. Llama a /auth/sync primero.');

    const canAccess = user.isOwner || (user.collaborations?.length ?? 0) > 0;
    if (!canAccess) throw new UnauthorizedException('El usuario no tiene acceso al dashboard.');

    const customToken = await admin.app().auth().createCustomToken(decoded.uid, {
      isOwner:        user.isOwner,
      organizationId: user.organization?.id ?? null,
    });

    this.logger.log(`customToken SSO generado: ${user.email}`);
    return { customToken, uid: decoded.uid, email: user.email };
  }
}
EOF
ok "auth/auth.service.ts"

cat > realsass-sass-back/src/auth/auth.controller.ts << 'EOF'
import {
  Body, Controller, Get, Headers,
  HttpCode, HttpStatus, NotFoundException, Post, Query,
} from '@nestjs/common';
import { AuthService }                           from './auth.service';
import { UsersService }                          from '../users/users.service';
import { Public, CurrentUser, type CurrentUserPayload } from '@real/auth-server';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth:  AuthService,
    private readonly users: UsersService,
  ) {}

  /** POST /api/v1/auth/sync — crea o actualiza el usuario. Idempotente. */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync(
    @CurrentUser() user: CurrentUserPayload,
    @Query('ref') affiliateCode?: string,
  ) {
    const result = await this.auth.syncUser(user, affiliateCode);
    return {
      success: true,
      isNew:   result.isNew,
      message: result.isNew ? 'Usuario creado' : 'Usuario sincronizado',
      data:    result.user,
    };
  }

  /** GET /api/v1/auth/me — perfil completo. */
  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.users.getMyProfile(user.uid);
    if (!profile) throw new NotFoundException('Usuario no encontrado. Llama a /auth/sync primero.');
    return { success: true, data: profile };
  }

  /** GET /api/v1/auth/organization-access — contrato con ecommerce-back. */
  @Get('organization-access')
  async organizationAccess(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') organizationId: string,
  ) {
    if (!organizationId) return { canAccess: false, reason: 'Header x-organization-id requerido' };
    return this.users.getOrganizationAccess(user.uid, organizationId);
  }

  /** POST /api/v1/auth/firebase-sso — SSO publico entre fronts. */
  @Public()
  @Post('firebase-sso')
  @HttpCode(HttpStatus.OK)
  async firebaseSso(@Body() body: { firebaseIdToken?: string }) {
    if (!body?.firebaseIdToken) throw new NotFoundException('firebaseIdToken requerido');
    const result = await this.auth.generateCustomToken(body.firebaseIdToken);
    return { success: true, ...result };
  }
}
EOF
ok "auth/auth.controller.ts"

cat > realsass-sass-back/src/users/users.module.ts << 'EOF'
import { Module }              from '@nestjs/common';
import { UsersController }     from './users.controller';
import { UsersService }        from './users.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports:     [OrganizationsModule],
  controllers: [UsersController],
  providers:   [UsersService],
  exports:     [UsersService],
})
export class UsersModule {}
EOF
ok "users/users.module.ts"

cat > realsass-sass-back/src/users/users.controller.ts << 'EOF'
import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Patch } from '@nestjs/common';
import { UsersService }                                from './users.service';
import { CurrentUser, type CurrentUserPayload }        from '@real/auth-server';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.users.getMyProfile(user.uid);
    if (!profile) throw new NotFoundException('Usuario no encontrado.');
    return { success: true, data: profile };
  }

  @Patch('me/role')
  @HttpCode(HttpStatus.OK)
  async selectRole(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { role: 'owner' | 'affiliate' },
  ) {
    return this.users.selectRole(user.uid, body);
  }
}
EOF
ok "users/users.controller.ts"


cat > realsass-sass-back/src/users/users.service.ts << 'EOF'
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService }        from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type { OrganizationAccessResult } from '@real/auth-server';

const FULL_PERMISSIONS: Record<string, boolean> = {
  canViewListings: true, canCreateListings: true, canEditListings: true,
  canDeleteListings: true, canViewStats: true, canManageLeads: true,
  canManageCollaborators: true,
};

function parsePermissions(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'boolean')
      .map(([k, v]) => [k, v as boolean]),
  );
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orgs:   OrganizationsService,
  ) {}

  async buildProfile(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        organization:  true,
        affiliateData: true,
        collaborations: {
          where:   { status: 'ACTIVE' },
          include: {
            organization: {
              select: {
                id: true, name: true, slug: true, logoUrl: true,
                description: true, website: true, phone: true, address: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const tenants = [];

    if (user.isOwner && user.organization) {
      tenants.push({
        organizationId: user.organization.id,
        organization:   user.organization,
        role:           'OWNER' as const,
        permissions:    FULL_PERMISSIONS,
      });
    }

    for (const collab of user.collaborations) {
      tenants.push({
        organizationId: collab.organizationId,
        organization:   collab.organization,
        role:           'COLLABORATOR' as const,
        permissions:    parsePermissions(collab.permissions),
      });
    }

    return {
      id:             user.id,
      firebaseUid:    user.firebaseUid,
      email:          user.email,
      displayName:    user.displayName,
      avatarUrl:      user.avatarUrl,
      isOwner:        user.isOwner,
      isAffiliate:    user.isAffiliate,
      affiliateCode:  user.affiliateCode,
      referredByCode: user.referredByCode,
      createdAt:      user.createdAt,
      updatedAt:      user.updatedAt,
      organization:   user.organization,
      tenants,
      affiliateData:  user.affiliateData
        ? {
            id:            user.affiliateData.id,
            balance:       user.affiliateData.balance.toString(),
            referralCount: user.affiliateData.referralCount,
            createdAt:     user.affiliateData.createdAt,
          }
        : null,
    };
  }

  async getMyProfile(firebaseUid: string) {
    const profile = await this.buildProfile(firebaseUid);
    if (!profile) throw new NotFoundException('Usuario no encontrado. Llama a /auth/sync primero.');
    return profile;
  }

  async getOrganizationAccess(
    firebaseUid: string,
    o
# =============================================================================
# PASO 4 — realsass-ecommerce-back: usar @real/auth-server
# =============================================================================
sep
log "PASO 4 — Actualizando realsass-ecommerce-back..."

node -e "
const fs  = require('fs');
const p   = 'realsass-ecommerce-back/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['@real/auth-server'] = 'workspace:*';
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
console.log('[ok] @real/auth-server agregado a ecommerce-back');
"

cat > realsass-ecommerce-back/src/app.module.ts << 'EOF'
import { Module }                     from '@nestjs/common';
import { APP_GUARD }                  from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule }               from '@nestjs/config';

import { PrismaModule }              from './prisma/prisma.module';
import { RedisModule }               from './redis/redis.module';
import { OrganizationsClientModule } from './organizations-client/organizations-client.module';
import { CatalogModule }             from './catalog/catalog.module';
import { InventoryModule }           from './inventory/inventory.module';
import { CustomersModule }           from './customers/customers.module';
import { ActivityModule }            from './activity/activity.module';
import { CartModule }                from './cart/cart.module';
import { OrdersModule }              from './orders/orders.module';
import { StoreModule }               from './store/store.module';
import { TrpcModule }                from './trpc/trpc.module';

import {
  FirebaseModule, FirebaseAuthGuard,
  CACHE_PORT, MemoryCacheAdapter,
} from '@real/auth-server';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 30 }]),
    FirebaseModule,
    PrismaModule,
    RedisModule,
    OrganizationsClientModule,
    CatalogModule,
    InventoryModule,
    CustomersModule,
    ActivityModule,
    CartModule,
    OrdersModule,
    StoreModule,
    TrpcModule,
  ],
  providers: [
    { provide: APP_GUARD,  useClass: FirebaseAuthGuard },
    { provide: APP_GUARD,  useClass: ThrottlerGuard },
    { provide: CACHE_PORT, useClass: MemoryCacheAdapter },
  ],
})
export class AppModule {}
EOF
ok "ecommerce-back/src/app.module.ts"

ok "PASO 4 completo — ecommerce-back actualizado"

# =============================================================================
# PASO 5 — realsass-sass-front: firebase.ts y auth-context del paquete
# =============================================================================
sep
log "PASO 5 — Actualizando realsass-sass-front..."

node -e "
const fs  = require('fs');
const p   = 'realsass-sass-front/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['@real/auth-client'] = 'workspace:*';
delete pkg.dependencies['firebase'];
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
console.log('[ok] @real/auth-client agregado a sass-front');
"

mkdir -p realsass-sass-front/features/auth/context
mkdir -p realsass-sass-front/features/auth/hooks

cat > realsass-sass-front/features/auth/context/auth-context.tsx << 'EOF'
'use client';
// Re-exporta desde @real/auth-client — los componentes importan de aca.
export { AuthProvider, useAuth } from '@real/auth-client';
export type { UserProfile }      from '@real/auth-client';
EOF

cat > realsass-sass-front/features/auth/hooks/use-auth.ts << 'EOF'
export { useAuth } from '@real/auth-client';
EOF

cat > realsass-sass-front/lib/firebase.ts << 'EOF'
/**
 * sass-front/lib/firebase.ts
 * Importar en app/layout.tsx antes del AuthProvider.
 */
import { initFirebase } from '@real/auth-client';

initFirebase({
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
});
EOF

cat > realsass-sass-front/AUTH_LAYOUT_PATCH.md << 'EOF'
# Cambios manuales requeridos en app/layout.tsx

## 1. Agregar al inicio del archivo
```tsx
import '@/lib/firebase'; // inicializa Firebase antes del AuthProvider
```

## 2. Actualizar AuthProvider con la prop sassBackUrl
```tsx
// ANTES:
<AuthProvider>{children}</AuthProvider>

// DESPUES:
<AuthProvider sassBackUrl={process.env.NEXT_PUBLIC_API_URL!}>
  {children}
</AuthProvider>
```
EOF
warn "sass-front: revisar AUTH_LAYOUT_PATCH.md"

ok "PASO 5 completo — sass-front actualizado"

# =============================================================================
# PASO 6 — realsass-dashboard-front: firebase.ts y auth-context del paquete
# =============================================================================
sep
log "PASO 6 — Actualizando realsass-dashboard-front..."

node -e "
const fs  = require('fs');
const p   = 'realsass-dashboard-front/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['@real/auth-client'] = 'workspace:*';
delete pkg.dependencies['firebase'];
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
console.log('[ok] @real/auth-client agregado a dashboard-front');
"

mkdir -p realsass-dashboard-front/features/auth/context
mkdir -p realsass-dashboard-front/features/auth/hooks

cat > realsass-dashboard-front/features/auth/context/auth-context.tsx << 'EOF'
'use client';
export { AuthProvider, useAuth } from '@real/auth-client';
export type { UserProfile }      from '@real/auth-client';
EOF

cat > realsass-dashboard-front/features/auth/hooks/use-auth.ts << 'EOF'
export { useAuth } from '@real/auth-client';
EOF

cat > realsass-dashboard-front/lib/firebase.ts << 'EOF'
/**
 * dashboard-front/lib/firebase.ts
 * Importar en app/layout.tsx antes del AuthProvider.
 */
import { initFirebase } from '@real/auth-client';

initFirebase({
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
});
EOF

cat > realsass-dashboard-front/AUTH_LAYOUT_PATCH.md << 'EOF'
# Cambios manuales requeridos en app/layout.tsx

## 1. Agregar al inicio del archivo
```tsx
import '@/lib/firebase';
```

## 2. Actualizar AuthProvider con la prop sassBackUrl
```tsx
// ANTES:
<AuthProvider>{children}</AuthProvider>

// DESPUES:
<AuthProvider sassBackUrl={process.env.NEXT_PUBLIC_REAL_BACK_URL!}>
  {children}
</AuthProvider>
```
EOF
warn "dashboard-front: revisar AUTH_LAYOUT_PATCH.md"

ok "PASO 6 completo — dashboard-front actualizado"

# =============================================================================
# PASO 7 — Verificar pnpm-workspace.yaml tiene packages/*
# =============================================================================
sep
log "PASO 7 — Verificando pnpm-workspace.yaml..."

if grep -q 'packages/\*' pnpm-workspace.yaml; then
  ok "pnpm-workspace.yaml ya incluye packages/*"
else
  warn "Agregar manualmente a pnpm-workspace.yaml:"
  warn '  - "packages/*"'
fi

# =============================================================================
# PASO 8 — pnpm install
# =============================================================================
sep
log "PASO 8 — pnpm install desde la raiz..."

pnpm install --ignore-scripts

ok "PASO 8 completo"

# =============================================================================
# RESUMEN FINAL
# =============================================================================
sep
echo -e "${BOLD}  SPRINT 1 COMPLETO${NC}"
sep
echo ""
echo -e "${GREEN}  Paquetes creados/actualizados:${NC}"
echo "    packages/auth-server  (@real/auth-server) — nuevo"
echo "    packages/auth-client  (@real/auth-client) — completado"
echo ""
echo -e "${GREEN}  Servicios actualizados:${NC}"
echo "    realsass-sass-back      — auth/ y users/ limpios, app.module.ts"
echo "    realsass-ecommerce-back — app.module.ts con @real/auth-server"
echo "    realsass-sass-front     — firebase.ts y auth-context del paquete"
echo "    realsass-dashboard-front — firebase.ts y auth-context del paquete"
echo ""
echo -e "${YELLOW}  Acciones manuales pendientes:${NC}"
echo "    1. realsass-sass-front/AUTH_LAYOUT_PATCH.md      -> editar app/layout.tsx"
echo "    2. realsass-dashboard-front/AUTH_LAYOUT_PATCH.md -> editar app/layout.tsx"
echo "    3. Agregar SASS_BACK_URL al .env de ecommerce-back"
echo "       SASS_BACK_URL=http://localhost:3004 (dev) o la URL de Railway (prod)"
echo ""
echo -e "${YELLOW}  Criterio de done del Sprint 1:${NC}"
echo "    [ ] Login con Google en sass-front -> perfil en DB"
echo "    [ ] Dashboard-front abre con dos pestanas, mismo usuario"
echo "    [ ] Request autenticado a ecommerce-back -> 200 con rol correcto"
echo "    [ ] Request con rol insuficiente -> 403"
echo ""
sep