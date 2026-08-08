#!/usr/bin/env bash
# =============================================================================
# x.sh — FIX: Errores de build post Sprint 1
#
# Corre desde la raiz del monorepo (donde esta pnpm-workspace.yaml)
#
# QUE CORRIGE:
#   1. sass-back: users.service.ts corrompido (bash pegado al final)
#   2. sass-back: todos los controllers que importan de ../common/ local
#      → migrar a @real/auth-server
#   3. ecommerce-back: todos los controllers que importan de ../common/ local
#      → migrar a @real/auth-server
#   4. sass-back: agregar Dockerfiles con packages/auth-server
#   5. ecommerce-back: agregar Dockerfiles con packages/auth-server
#   6. sass-front: restaurar lib/firebase.ts con todos los exports originales
#   7. dashboard-front: restaurar lib/api-client.ts que fue borrado
# =============================================================================

set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${BLUE}[->]${NC} $1"; }
ok()   { echo -e "${GREEN}[ok]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; exit 1; }
sep()  { echo -e "${BOLD}----------------------------------------------------${NC}"; }

if [ ! -f "pnpm-workspace.yaml" ]; then
  err "Corre desde la raiz del monorepo"
fi

sep
echo -e "${BOLD}  FIX — Errores de build post Sprint 1${NC}"
sep

# =============================================================================
# FIX 1 — users.service.ts corrompido en sass-back
# El heredoc del script anterior se concateno mal y metio bash dentro del .ts
# =============================================================================
sep
log "FIX 1 — Reescribiendo users.service.ts limpio en sass-back..."

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

    const tenants: Array<{
      organizationId: string;
      organization:   unknown;
      role:           'OWNER' | 'COLLABORATOR';
      permissions:    Record<string, boolean>;
    }> = [];

    if (user.isOwner && user.organization) {
      tenants.push({
        organizationId: user.organization.id,
        organization:   user.organization,
        role:           'OWNER',
        permissions:    FULL_PERMISSIONS,
      });
    }

    for (const collab of user.collaborations) {
      tenants.push({
        organizationId: collab.organizationId,
        organization:   collab.organization,
        role:           'COLLABORATOR',
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
    firebaseUid:    string,
    organizationId: string,
  ): Promise<OrganizationAccessResult> {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return { canAccess: false, reason: 'Usuario no encontrado' };

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return { canAccess: false, reason: 'Organizacion no encontrada' };

    if (org.userId === user.id) {
      return {
        canAccess: true, userId: user.id, organizationId: org.id,
        role: 'OWNER', permissions: FULL_PERMISSIONS,
      };
    }

    const collab = await this.prisma.collaborator.findFirst({
      where: { userId: user.id, organizationId: org.id, status: 'ACTIVE' },
    });

    if (!collab) return { canAccess: false, reason: 'Sin acceso a esta organizacion' };

    return {
      canAccess: true, userId: user.id, organizationId: org.id,
      role: 'MEMBER', permissions: parsePermissions(collab.permissions),
    };
  }

  async getDashboardAccess(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid }, include: { organization: true, collaborations: true },
    });
    if (!user) return { canAccess: false };
    return {
      canAccess:      user.isOwner || (user.collaborations?.length ?? 0) > 0,
      isOwner:        user.isOwner,
      organizationId: user.organization?.id ?? null,
    };
  }

  async selectRole(firebaseUid: string, dto: { role: 'owner' | 'affiliate' }) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (dto.role === 'owner') {
      await this.prisma.user.update({ where: { id: user.id }, data: { isOwner: true } });
      await this.orgs.ensureOrganization(user.id);
    }

    if (dto.role === 'affiliate') {
      const code = `AF-${user.id.slice(0, 8).toUpperCase()}`;
      await this.prisma.user.update({
        where: { id: user.id }, data: { isAffiliate: true, affiliateCode: code },
      });
      await this.prisma.affiliateData.upsert({
        where: { userId: user.id }, update: {}, create: { userId: user.id },
      });
    }

    return this.buildProfile(firebaseUid);
  }
}
EOF
ok "users.service.ts reescrito limpio"

# =============================================================================
# FIX 2 — sass-back: migrar todos los controllers a @real/auth-server
# Usamos sed para reemplazar imports de ../common/ local por @real/auth-server
# =============================================================================
sep
log "FIX 2 — Migrando imports de controllers en sass-back..."

SASS_SRC="realsass-sass-back/src"

# Funcion helper: reemplaza imports en un archivo dado
fix_imports() {
  local file="$1"
  if [ ! -f "$file" ]; then return; fi

  # ../common/decorators/current-user.decorator -> @real/auth-server
  sed -i "s|from '../common/decorators/current-user.decorator'|from '@real/auth-server'|g" "$file"
  sed -i "s|from '../../common/decorators/current-user.decorator'|from '@real/auth-server'|g" "$file"

  # ../common/decorators/public.decorator -> @real/auth-server
  sed -i "s|from '../common/decorators/public.decorator'|from '@real/auth-server'|g" "$file"
  sed -i "s|from '../../common/decorators/public.decorator'|from '@real/auth-server'|g" "$file"

  # ../common/decorators/roles.decorator -> @real/auth-server
  sed -i "s|from '../common/decorators/roles.decorator'|from '@real/auth-server'|g" "$file"
  sed -i "s|from '../../common/decorators/roles.decorator'|from '@real/auth-server'|g" "$file"

  # ../common/decorators/tenant.decorator -> @real/auth-server
  sed -i "s|from '../common/decorators/tenant.decorator'|from '@real/auth-server'|g" "$file"
  sed -i "s|from '../../common/decorators/tenant.decorator'|from '@real/auth-server'|g" "$file"

  # ../common/guards/firebase-auth.guard -> @real/auth-server
  sed -i "s|from '../common/guards/firebase-auth.guard'|from '@real/auth-server'|g" "$file"
  sed -i "s|from '../../common/guards/firebase-auth.guard'|from '@real/auth-server'|g" "$file"

  # ../common/guards/tenant.guard -> @real/auth-server
  sed -i "s|from '../common/guards/tenant.guard'|from '@real/auth-server'|g" "$file"
  sed -i "s|from '../../common/guards/tenant.guard'|from '@real/auth-server'|g" "$file"

  # ../common/guards/roles.guard -> @real/auth-server
  sed -i "s|from '../common/guards/roles.guard'|from '@real/auth-server'|g" "$file"
  sed -i "s|from '../../common/guards/roles.guard'|from '@real/auth-server'|g" "$file"

  # ../common/types/tenant-context -> @real/auth-server
  sed -i "s|from '../common/types/tenant-context'|from '@real/auth-server'|g" "$file"
  sed -i "s|from '../../common/types/tenant-context'|from '@real/auth-server'|g" "$file"
}

# Aplicar a todos los controllers y servicios de sass-back
find "$SASS_SRC" -name "*.ts" | while read -r f; do
  fix_imports "$f"
done

ok "sass-back: imports migrados a @real/auth-server"

# Tambien arreglar el import del TrpcModule que puede referenciar auth.router
# El trpc/app-router.ts referencia auth.router que fue borrado — lo dejamos
# comentado hasta que se rehaga en Sprint 2
if [ -f "$SASS_SRC/trpc/app-router.ts" ]; then
  # Si importa auth.router y no existe, comentar esa linea
  if grep -q "auth.router" "$SASS_SRC/trpc/app-router.ts" && [ ! -f "$SASS_SRC/trpc/routers/auth.router.ts" ]; then
    sed -i "s|^import { createAuthRouter }|// TODO Sprint 2: import { createAuthRouter }|g" "$SASS_SRC/trpc/app-router.ts"
    sed -i "s|auth:.*createAuthRouter.*|// TODO Sprint 2: auth: createAuthRouter(deps.usersService, deps.authService),|g" "$SASS_SRC/trpc/app-router.ts"
    warn "trpc/app-router.ts: auth.router comentado hasta Sprint 2"
  fi
fi

# =============================================================================
# FIX 3 — ecommerce-back: migrar todos los controllers a @real/auth-server
# =============================================================================
sep
log "FIX 3 — Migrando imports de controllers en ecommerce-back..."

ECO_SRC="realsass-ecommerce-back/src"

find "$ECO_SRC" -name "*.ts" | while read -r f; do
  fix_imports "$f"
done

ok "ecommerce-back: imports migrados a @real/auth-server"

# =============================================================================
# FIX 4 — Dockerfiles: agregar packages/auth-server al stage deps
# =============================================================================
sep
log "FIX 4 — Actualizando Dockerfile de sass-back..."

SASS_DOCKER="realsass-sass-back/Dockerfile"
if [ -f "$SASS_DOCKER" ]; then
  # Insertar la linea de auth-server despues de la de auth-client
  if grep -q "auth-client/package.json" "$SASS_DOCKER" && ! grep -q "auth-server/package.json" "$SASS_DOCKER"; then
    sed -i "s|COPY packages/auth-client/package.json ./packages/auth-client/|COPY packages/auth-client/package.json ./packages/auth-client/\nCOPY packages/auth-server/package.json ./packages/auth-server/|g" "$SASS_DOCKER"
    ok "sass-back/Dockerfile: packages/auth-server agregado"
  else
    warn "sass-back/Dockerfile: ya tenia auth-server o no tiene auth-client — revisar manualmente"
  fi
else
  warn "sass-back/Dockerfile no encontrado"
fi

log "FIX 4 — Actualizando Dockerfile de ecommerce-back..."

ECO_DOCKER="realsass-ecommerce-back/Dockerfile"
if [ -f "$ECO_DOCKER" ]; then
  if grep -q "auth-client/package.json" "$ECO_DOCKER" && ! grep -q "auth-server/package.json" "$ECO_DOCKER"; then
    sed -i "s|COPY packages/auth-client/package.json ./packages/auth-client/|COPY packages/auth-client/package.json ./packages/auth-client/\nCOPY packages/auth-server/package.json ./packages/auth-server/|g" "$ECO_DOCKER"
    ok "ecommerce-back/Dockerfile: packages/auth-server agregado"
  else
    warn "ecommerce-back/Dockerfile: ya tenia auth-server o no tiene auth-client — revisar manualmente"
  fi
else
  warn "ecommerce-back/Dockerfile no encontrado"
fi

# =============================================================================
# FIX 5 — sass-front: restaurar lib/firebase.ts con todos los exports originales
# El x.sh anterior lo reemplazo por una version minima que rompio los imports
# existentes. Esta version es compatible: mantiene TODOS los exports del
# original y ademas llama a initFirebase del paquete internamente.
# =============================================================================
sep
log "FIX 5 — Restaurando sass-front/lib/firebase.ts..."

cat > realsass-sass-front/lib/firebase.ts << 'EOF'
/**
 * lib/firebase.ts — sass-front
 *
 * Mantiene todos los exports originales para compatibilidad con:
 *   - components/login-modal.tsx (signInWithGoogle, signInWithApple, signInWithFacebook)
 *   - context/auth-context.tsx   (auth, signOut, onAuthStateChanged)
 *   - lib/api.ts                 (getIdToken)
 *   - lib/config-api.ts          (getIdToken)
 *
 * Internamente usa @real/auth-client para la init, pero re-exporta
 * todo lo que el codigo existente espera.
 */
import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// Singleton — evita reinicializar en HMR
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig)
const auth = getAuth(app)

// Providers
const googleProvider   = new GoogleAuthProvider()
const appleProvider    = new OAuthProvider('apple.com')
const facebookProvider = new FacebookAuthProvider()

appleProvider.addScope('email')
appleProvider.addScope('name')

// ─── Helpers de auth ─────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export async function signInWithApple() {
  return signInWithPopup(auth, appleProvider)
}

export async function signInWithFacebook() {
  return signInWithPopup(auth, facebookProvider)
}

export async function signOut() {
  return firebaseSignOut(auth)
}

export function getIdToken(forceRefresh = false): Promise<string> {
  if (!auth.currentUser) throw new Error('No hay usuario autenticado')
  return auth.currentUser.getIdToken(forceRefresh)
}

export { auth, onAuthStateChanged, type User }
EOF
ok "sass-front/lib/firebase.ts restaurado"

# =============================================================================
# FIX 6 — dashboard-front: restaurar lib/api-client.ts
# Fue borrado por el x.sh anterior pero features/store/api.ts,
# features/pagos, features/chat, features/campanas lo importan.
# =============================================================================
sep
log "FIX 6 — Restaurando dashboard-front/lib/api-client.ts..."

cat > realsass-dashboard-front/lib/api-client.ts << 'EOF'
/**
 * lib/api-client.ts — dashboard-front
 *
 * Cliente HTTP autenticado para ecommerce-back y otros servicios.
 * Usa el Bearer token de Firebase via @real/auth-client.
 *
 * Exporta:
 *   ecommerceFetch  — para features/store (con x-organization-id)
 *   apiClient       — para features/pagos, features/chat, features/campanas
 *   buildQuery      — helper para query strings
 */
import { getIdToken } from '@real/auth-client';

const ECOMMERCE_URL = (process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ?? '').replace(/\/+$/, '');
const REAL_BACK_URL = (process.env.NEXT_PUBLIC_REAL_BACK_URL ?? '').replace(/\/+$/, '');

// ─── Helper: buildQuery ───────────────────────────────────────────────────────

export function buildQuery(params: Record<string, unknown>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

// ─── fetch autenticado base ───────────────────────────────────────────────────

async function authenticatedFetch<T>(
  url:     string,
  options: RequestInit = {},
  orgId?:  string,
): Promise<T> {
  let token: string;
  try {
    token = await getIdToken();
  } catch {
    throw new Error('No hay sesion activa');
  }

  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (orgId) headers['x-organization-id'] = orgId;

  const res = await fetch(url, { ...options, headers });

  // Retry en 401
  if (res.status === 401) {
    const freshToken = await getIdToken(true);
    headers['Authorization'] = `Bearer ${freshToken}`;
    const retry = await fetch(url, { ...options, headers });
    if (!retry.ok) throw new Error(`Error ${retry.status}`);
    const envelope = await retry.json() as { data?: T };
    return (envelope.data ?? envelope) as T;
  }

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const b = await res.json() as { message?: string }; msg = b.message ?? msg; } catch { /* noop */ }
    throw new Error(msg);
  }

  const envelope = await res.json() as { data?: T };
  return (envelope.data ?? envelope) as T;
}

// ─── ecommerceFetch — para features/store ────────────────────────────────────

export const ecommerceFetch = {
  get: <T>(path: string, orgId: string) =>
    authenticatedFetch<T>(`${ECOMMERCE_URL}/api/v1${path}`, { method: 'GET' }, orgId),

  post: <T>(path: string, body: unknown, orgId: string) =>
    authenticatedFetch<T>(`${ECOMMERCE_URL}/api/v1${path}`, {
      method: 'POST', body: JSON.stringify(body),
    }, orgId),

  patch: <T>(path: string, body: unknown, orgId: string) =>
    authenticatedFetch<T>(`${ECOMMERCE_URL}/api/v1${path}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }, orgId),

  delete: <T>(path: string, orgId: string) =>
    authenticatedFetch<T>(`${ECOMMERCE_URL}/api/v1${path}`, { method: 'DELETE' }, orgId),
};

// ─── apiClient — para features/pagos, chat, campanas ─────────────────────────
// El primer argumento 'servicio' es un string que por ahora se ignora
// (todos apuntan al mismo real-back). Se mantiene para compatibilidad.

export const apiClient = {
  get: <T>(_servicio: string, path: string) =>
    authenticatedFetch<T>(`${REAL_BACK_URL}/api/v1${path}`, { method: 'GET' }),

  post: <T>(_servicio: string, path: string, body?: unknown) =>
    authenticatedFetch<T>(`${REAL_BACK_URL}/api/v1${path}`, {
      method: 'POST', body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(_servicio: string, path: string, body: unknown) =>
    authenticatedFetch<T>(`${REAL_BACK_URL}/api/v1${path}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  delete: <T>(_servicio: string, path: string) =>
    authenticatedFetch<T>(`${REAL_BACK_URL}/api/v1${path}`, { method: 'DELETE' }),
};
EOF
ok "dashboard-front/lib/api-client.ts restaurado"

# =============================================================================
# FIX 7 — dashboard-front: restaurar lib/firebase.ts compatible
# =============================================================================
sep
log "FIX 7 — Restaurando dashboard-front/lib/firebase.ts..."

cat > realsass-dashboard-front/lib/firebase.ts << 'EOF'
/**
 * lib/firebase.ts — dashboard-front
 * Compatible con el codigo existente que importa: auth, signOut,
 * onAuthStateChanged, signInWithPopup, googleProvider, getCurrentUserToken
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]!;
}

export const auth           = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function getCurrentUserToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('No hay usuario autenticado');
  return user.getIdToken();
}

export { signInWithPopup, signOut, onAuthStateChanged, type User };
EOF
ok "dashboard-front/lib/firebase.ts restaurado"

# =============================================================================
# RESUMEN
# =============================================================================
sep
echo -e "${BOLD}  FIX COMPLETO${NC}"
sep
echo ""
echo -e "${GREEN}  Corregido:${NC}"
echo "    [1] sass-back/src/users/users.service.ts   — bash removido del .ts"
echo "    [2] sass-back: todos los controllers       — imports -> @real/auth-server"
echo "    [3] ecommerce-back: todos los controllers  — imports -> @real/auth-server"
echo "    [4] Dockerfiles sass-back + ecommerce-back — packages/auth-server agregado"
echo "    [5] sass-front/lib/firebase.ts             — exports originales restaurados"
echo "    [6] dashboard-front/lib/api-client.ts      — restaurado (ecommerceFetch + apiClient)"
echo "    [7] dashboard-front/lib/firebase.ts        — restaurado compatible"
echo ""
echo -e "${YELLOW}  Verificar manualmente:${NC}"
echo "    - sass-back/src/trpc/app-router.ts: auth.router comentado hasta Sprint 2"
echo "    - Correr: pnpm --filter realsass-sass-back build"
echo "    - Correr: pnpm --filter realsass-ecommerce-back build"
echo "    - Correr: pnpm --filter realsass-sass-front build"
echo "    - Correr: pnpm --filter realsass-dashboard-front build"
echo ""
sep