#!/usr/bin/env bash
# =============================================================================
# x.sh — Dashboard-front: solo SSO desde sass-front, sin login propio
#
# DISEÑO:
#   realsass-sass-front → POST /api/v1/auth/firebase-sso → customToken
#                       → redirect /auth/sso?token=... (dashboard-front)
#                       → signInWithCustomToken → onAuthStateChanged
#                       → sync con sass-back → organizationId → /dashboard
#
# El dashboard-front NO tiene login propio.
# /login redirige al sass-front (NEXT_PUBLIC_SASS_FRONT_URL).
# Todo el auth vive en Firebase SDK — sin cookies propias, sin middleware.
# El race condition se resuelve esperando onAuthStateChanged antes de navegar.
#
# ARCHIVOS TOCADOS:
#   ELIMINA  realsass-dashboard-front/middleware.ts
#   ELIMINA  realsass-dashboard-front/app/api/auth/ (route handlers de cookie)
#   MOD      realsass-dashboard-front/app/login/page.tsx
#   MOD      realsass-dashboard-front/app/auth/sso/page.tsx
#   MOD      realsass-dashboard-front/lib/firebase.ts
#   MOD      realsass-dashboard-front/lib/api-client.ts
#   MOD      realsass-dashboard-front/features/auth/context/auth-context.tsx
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${YELLOW}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }

ROOT="realsass-dashboard-front"
[ -d "$ROOT" ] || { echo -e "${RED}✗${NC} No se encontró $ROOT/ — correr desde la raíz del monorepo"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# 1) Eliminar artefactos del x.sh anterior (middleware + route handlers cookie)
# ─────────────────────────────────────────────────────────────────────────────
log "Limpiando artefactos del x.sh anterior..."

[ -f "$ROOT/middleware.ts" ] && rm "$ROOT/middleware.ts" && warn "middleware.ts eliminado"
[ -d "$ROOT/app/api/auth" ] && rm -rf "$ROOT/app/api/auth" && warn "app/api/auth/ eliminado"

ok "Limpieza completa"

# ─────────────────────────────────────────────────────────────────────────────
# 2) lib/firebase.ts — solo lo necesario: auth + waitForUser + getCurrentUserToken
#    Sin persistSession ni clearSession (no usamos cookies propias)
# ─────────────────────────────────────────────────────────────────────────────
log "Escribiendo $ROOT/lib/firebase.ts..."

cat > "$ROOT/lib/firebase.ts" << 'EOF'
// lib/firebase.ts
// Firebase client SDK para realsass-dashboard-front.
// Auth exclusivamente via SSO desde realsass-sass-front.
// No hay login propio — signInWithCustomToken es el único entry point.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken,
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

export const auth = getAuth(app);

/**
 * Espera hasta `timeoutMs` ms a que Firebase resuelva auth.currentUser.
 *
 * Necesario después de signInWithCustomToken: Firebase confirma la sesión
 * de forma asíncrona. Sin esta espera, los primeros fetches salen sin token.
 */
export function waitForAuthReady(timeoutMs = 5000): Promise<User | null> {
  return new Promise((resolve) => {
    // Si ya está resuelto, devolver inmediatamente
    if (auth.currentUser !== null) {
      resolve(auth.currentUser);
      return;
    }
    const timer = setTimeout(() => { unsub(); resolve(null); }, timeoutMs);
    const unsub = onAuthStateChanged(auth, (user) => {
      clearTimeout(timer);
      unsub();
      resolve(user);
    });
  });
}

/**
 * Retorna el Firebase ID token del usuario actual.
 * - Espera hasta 5s si auth.currentUser es null (post-SSO).
 * - forceRefresh=true renueva el token contra Firebase (para retry en 401).
 */
export async function getCurrentUserToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser ?? await waitForAuthReady();
  if (!user) throw new Error('No hay usuario autenticado');
  return user.getIdToken(forceRefresh);
}

export { signOut, onAuthStateChanged, signInWithCustomToken, type User };
EOF

ok "$ROOT/lib/firebase.ts listo"

# ─────────────────────────────────────────────────────────────────────────────
# 3) lib/api-client.ts — retry en 401 con forceRefresh
# ─────────────────────────────────────────────────────────────────────────────
log "Escribiendo $ROOT/lib/api-client.ts..."

cat > "$ROOT/lib/api-client.ts" << 'EOF'
// lib/api-client.ts
// Helpers HTTP hacia realsass-sass-back y realsass-ecommerce-back.
// Retry automático en 401: forceRefresh del token Firebase + un reintento.

import { getCurrentUserToken } from './firebase';

function getRealBackBase(): string {
  const url = process.env.NEXT_PUBLIC_REAL_BACK_URL ?? '';
  if (!url) throw new Error('NEXT_PUBLIC_REAL_BACK_URL no configurado');
  return url.replace(/\/+$/, '');
}

function getEcommerceBase(): string {
  const url = process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ?? '';
  if (!url) throw new Error('NEXT_PUBLIC_ECOMMERCE_API_URL no configurado');
  return url.replace(/\/+$/, '');
}

export function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function getToken(forceRefresh = false): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  try { return await getCurrentUserToken(forceRefresh); }
  catch { return undefined; }
}

interface FetchOptions {
  method?:   string;
  body?:     unknown;
  orgId?:    string;
  signal?:   AbortSignal;
  _isRetry?: boolean;
}

async function coreFetch<T>(
  baseUrl: string,
  path: string,
  { method = 'GET', body, orgId, signal, _isRetry = false }: FetchOptions = {},
): Promise<T> {
  const token = await getToken(_isRetry);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId  ? { 'x-organization-id': orgId }      : {}),
  };

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  // Un solo retry con token fresco en el primer 401
  if (res.status === 401 && !_isRetry) {
    return coreFetch<T>(baseUrl, path, { method, body, orgId, signal, _isRetry: true });
  }

  const json = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    const msg =
      (json['message'] as string | undefined) ??
      (json['error']   as string | undefined) ??
      `Error ${res.status}`;
    throw new Error(msg);
  }

  return (json['data'] as T | undefined) ?? json as unknown as T;
}

// ─── realsass-sass-back (identidad + org + config) ────────────────────────────
export const realBackFetch = {
  get:    <T>(path: string, orgId?: string) =>
    coreFetch<T>(getRealBackBase(), path, { orgId }),
  post:   <T>(path: string, body: unknown, orgId?: string) =>
    coreFetch<T>(getRealBackBase(), path, { method: 'POST', body, orgId }),
  patch:  <T>(path: string, body: unknown, orgId?: string) =>
    coreFetch<T>(getRealBackBase(), path, { method: 'PATCH', body, orgId }),
  delete: <T>(path: string, orgId?: string) =>
    coreFetch<T>(getRealBackBase(), path, { method: 'DELETE', orgId }),
};

// ─── realsass-ecommerce-back (CMS productos + pedidos) ────────────────────────
export const ecommerceFetch = {
  get:    <T>(path: string, orgId: string) =>
    coreFetch<T>(getEcommerceBase(), path, { orgId }),
  post:   <T>(path: string, body: unknown, orgId: string) =>
    coreFetch<T>(getEcommerceBase(), path, { method: 'POST', body, orgId }),
  patch:  <T>(path: string, body: unknown, orgId: string) =>
    coreFetch<T>(getEcommerceBase(), path, { method: 'PATCH', body, orgId }),
  delete: <T>(path: string, orgId: string) =>
    coreFetch<T>(getEcommerceBase(), path, { method: 'DELETE', orgId }),
};
EOF

ok "$ROOT/lib/api-client.ts listo"

# ─────────────────────────────────────────────────────────────────────────────
# 4) app/auth/sso/page.tsx — espera onAuthStateChanged ANTES de navegar
# ─────────────────────────────────────────────────────────────────────────────
log "Escribiendo $ROOT/app/auth/sso/page.tsx..."
mkdir -p "$ROOT/app/auth/sso"

cat > "$ROOT/app/auth/sso/page.tsx" << 'EOF'
// app/auth/sso/page.tsx
//
// Entry point del flujo SSO desde realsass-sass-front.
//
// Flujo:
//   sass-front → POST /api/v1/auth/firebase-sso (sass-back) → customToken
//             → redirect aquí con ?token=<customToken>
//   1. signInWithCustomToken(auth, customToken)
//   2. waitForAuthReady() — espera que Firebase confirme la sesión
//      (sin esto, router.replace('/dashboard') monta los componentes
//       antes de que onAuthStateChanged dispare y los fetches salen sin token)
//   3. router.replace('/dashboard')
'use client';

import { useEffect, useState }        from 'react';
import { useRouter }                  from 'next/navigation';
import { Loader2, AlertCircle }       from 'lucide-react';
import { signInWithCustomToken }      from 'firebase/auth';
import { auth, waitForAuthReady }     from '@/lib/firebase';

type State = 'loading' | 'error';

export default function SsoPage() {
  const router = useRouter();
  const [state,   setState]   = useState<State>('loading');
  const [message, setMessage] = useState('Iniciando sesión...');

  useEffect(() => {
    const run = async () => {
      try {
        const params      = new URLSearchParams(window.location.search);
        const customToken = params.get('token');

        if (!customToken) {
          setMessage('Token no encontrado. Volvé a intentarlo desde el inicio.');
          setState('error');
          return;
        }

        setMessage('Verificando credenciales...');

        // 1. Firebase establece la sesión con el customToken
        await signInWithCustomToken(auth, customToken);

        // 2. Esperar que onAuthStateChanged confirme auth.currentUser !== null
        //    ANTES de navegar. Esto garantiza que cuando el DashboardLayout
        //    y los hooks de TanStack Query monten, el token ya está disponible.
        setMessage('Estableciendo sesión...');
        const user = await waitForAuthReady(5000);

        if (!user) {
          setMessage('No se pudo establecer la sesión. Intentá de nuevo.');
          setState('error');
          return;
        }

        setMessage('Redirigiendo...');
        router.replace('/dashboard');

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido';
        console.error('[SSO]', msg);
        setMessage('No se pudo iniciar sesión. El enlace puede haber expirado.');
        setState('error');
      }
    };

    run();
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      {state === 'loading' && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </>
      )}
      {state === 'error' && (
        <>
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-destructive text-center max-w-xs">{message}</p>
          <a
            href={process.env.NEXT_PUBLIC_SASS_FRONT_URL ?? '/'}
            className="text-xs text-primary underline underline-offset-2"
          >
            Volver al inicio
          </a>
        </>
      )}
    </main>
  );
}
EOF

ok "$ROOT/app/auth/sso/page.tsx listo"

# ─────────────────────────────────────────────────────────────────────────────
# 5) app/login/page.tsx — redirige al sass-front, no tiene login propio
# ─────────────────────────────────────────────────────────────────────────────
log "Escribiendo $ROOT/app/login/page.tsx..."
mkdir -p "$ROOT/app/login"

cat > "$ROOT/app/login/page.tsx" << 'EOF'
// app/login/page.tsx
//
// El dashboard-front no tiene login propio.
// El acceso es exclusivamente via SSO desde realsass-sass-front.
// Esta página redirige al usuario al sass-front para que inicie sesión allá.
'use client';

import { useEffect }   from 'react';
import { Loader2 }     from 'lucide-react';

const SASS_FRONT_URL = process.env.NEXT_PUBLIC_SASS_FRONT_URL ?? '';

export default function LoginPage() {
  useEffect(() => {
    if (SASS_FRONT_URL) {
      window.location.href = SASS_FRONT_URL;
    }
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Redirigiendo al sistema de organizaciones...
      </p>
      {SASS_FRONT_URL ? (
        <a
          href={SASS_FRONT_URL}
          className="text-xs text-primary underline underline-offset-2"
        >
          Ir ahora
        </a>
      ) : (
        <p className="text-xs text-destructive">
          NEXT_PUBLIC_SASS_FRONT_URL no configurado
        </p>
      )}
    </main>
  );
}
EOF

ok "$ROOT/app/login/page.tsx listo"

# ─────────────────────────────────────────────────────────────────────────────
# 6) auth-context.tsx — sin login propio, sin register, solo SSO
# ─────────────────────────────────────────────────────────────────────────────
log "Escribiendo $ROOT/features/auth/context/auth-context.tsx..."
mkdir -p "$ROOT/features/auth/context"

cat > "$ROOT/features/auth/context/auth-context.tsx" << 'EOF'
'use client';

// =============================================================================
// auth-context.tsx — SSO-only auth para realsass-dashboard-front
//
// Flujo de entrada:
//   realsass-sass-front → /api/v1/auth/firebase-sso (sass-back) → customToken
//   → /auth/sso?token=... → signInWithCustomToken → onAuthStateChanged
//   → syncWithSassBack() → organizationId → /dashboard
//
// No hay login propio. loginWithGoogle() redirige al sass-front.
// El token Firebase lo maneja el SDK automáticamente (refresh cada ~55min).
// =============================================================================

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import { useRouter }              from 'next/navigation';
import {
  auth, signOut, onAuthStateChanged, type User as FirebaseUser,
} from '@/lib/firebase';
import { realBackFetch }          from '@/lib/api-client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DashboardUser {
  id:          string;
  firebaseUid: string;
  email:       string;
  displayName: string | null;
  avatarUrl:   string | null;
  isOwner:     boolean;
  isAffiliate: boolean;
  createdAt:   string;
}

interface AuthContextType {
  user:              DashboardUser | null;
  firebaseUser:      DashboardUser | null; // alias — compatibilidad
  isLoading:         boolean;
  isAuthenticated:   boolean;
  organizationId:    string | null;
  setOrganizationId: (id: string) => void;
  loginWithGoogle:   () => Promise<void>;  // redirige al sass-front
  logout:            () => Promise<void>;
  refreshUser:       () => Promise<void>;
}

const Ctx = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return c;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_KEY       = 'dash_org_id';
const SASS_FRONT    = process.env.NEXT_PUBLIC_SASS_FRONT_URL ?? '';

async function syncWithSassBack(fbUser: FirebaseUser): Promise<{
  user: DashboardUser;
  organizationId: string | null;
} | null> {
  try {
    // Upsert idempotente — crea el user en sass-back si no existe
    await realBackFetch.post('/api/v1/auth/sync', {
      firebaseUid: fbUser.uid,
      email:       fbUser.email,
      displayName: fbUser.displayName,
      avatarUrl:   fbUser.photoURL,
    });

    // Traer perfil completo con organizationId
    const data = await realBackFetch.get<{
      user:           DashboardUser;
      organizationId: string | null;
    }>('/api/v1/users/me');

    return data;
  } catch (err) {
    console.error('[Auth] Error sincronizando con sass-back:', err);
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]    = useState<DashboardUser | null>(null);
  const [orgId,     setOrgId]   = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const router      = useRouter();
  const didInit     = useRef(false);

  const setOrganizationId = useCallback((id: string) => {
    setOrgId(id);
    if (typeof window !== 'undefined') localStorage.setItem(ORG_KEY, id);
  }, []);

  const handleFirebaseUser = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      setUser(null);
      setOrgId(null);
      setLoading(false);
      return;
    }

    const result = await syncWithSassBack(fbUser);

    if (!result) {
      // sass-back no disponible o usuario sin acceso
      setUser(null);
      setOrgId(null);
      setLoading(false);
      return;
    }

    setUser(result.user);

    // Recuperar orgId: localStorage primero (evita un round-trip extra)
    const stored = typeof window !== 'undefined' ? localStorage.getItem(ORG_KEY) : null;
    const resolvedOrgId = stored ?? result.organizationId;

    if (resolvedOrgId) {
      setOrgId(resolvedOrgId);
      if (!stored) localStorage.setItem(ORG_KEY, resolvedOrgId);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      // onAuthStateChanged puede disparar múltiples veces — solo procesar una
      if (didInit.current && fbUser?.uid === auth.currentUser?.uid) return;
      didInit.current = true;
      await handleFirebaseUser(fbUser);
    });
    return () => unsub();
  }, [handleFirebaseUser]);

  // "login" = redirigir al sass-front para que haga el SSO
  const loginWithGoogle = useCallback(async () => {
    if (SASS_FRONT) {
      window.location.href = SASS_FRONT;
    } else {
      console.error('[Auth] NEXT_PUBLIC_SASS_FRONT_URL no configurado');
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    if (typeof window !== 'undefined') localStorage.removeItem(ORG_KEY);
    setUser(null);
    setOrgId(null);
    // Redirigir al sass-front en lugar del /login local
    if (SASS_FRONT) {
      window.location.href = SASS_FRONT;
    } else {
      router.push('/login');
    }
  }, [router]);

  const refreshUser = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    const result = await syncWithSassBack(fbUser);
    if (result) setUser(result.user);
  }, []);

  return (
    <Ctx.Provider value={{
      user,
      firebaseUser:    user,
      isLoading,
      isAuthenticated: !!user,
      organizationId:  orgId,
      setOrganizationId,
      loginWithGoogle,
      logout,
      refreshUser,
    }}>
      {children}
    </Ctx.Provider>
  );
}
EOF

ok "$ROOT/features/auth/context/auth-context.tsx listo"

# ─────────────────────────────────────────────────────────────────────────────
# Resumen
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "  ════════════════════════════════════════════════════════════════"
echo "  Cambios aplicados en $ROOT:"
echo ""
echo "  ELIMINADO  middleware.ts (rompía el SSO flow)"
echo "  ELIMINADO  app/api/auth/ (route handlers de cookie — no necesarios)"
echo ""
echo "  app/auth/sso/page.tsx"
echo "    waitForAuthReady() ANTES de router.replace('/dashboard')"
echo "    Garantiza auth.currentUser != null cuando los componentes montan"
echo ""
echo "  app/login/page.tsx"
echo "    Ya no tiene login propio — redirige a NEXT_PUBLIC_SASS_FRONT_URL"
echo ""
echo "  lib/firebase.ts"
echo "    waitForAuthReady(5000) — espera hasta 5s a Firebase post-SSO"
echo "    getCurrentUserToken(forceRefresh) — para retry en 401"
echo "    Solo signInWithCustomToken como entry point (sin signInWithPopup)"
echo ""
echo "  lib/api-client.ts"
echo "    Retry automático en 401 con token fresco (forceRefresh=true)"
echo ""
echo "  features/auth/context/auth-context.tsx"
echo "    Sin login propio ni register"
echo "    loginWithGoogle() → redirige a NEXT_PUBLIC_SASS_FRONT_URL"
echo "    logout() → signOut Firebase + redirige a NEXT_PUBLIC_SASS_FRONT_URL"
echo "    syncWithSassBack() → /api/v1/auth/sync + /api/v1/users/me"
echo ""
echo "  ⚠  Agregar en Railway (realsass-dashboard-front → Variables):"
echo "     NEXT_PUBLIC_SASS_FRONT_URL=https://tu-sass-front.up.railway.app"
echo "  ════════════════════════════════════════════════════════════════"
echo ""