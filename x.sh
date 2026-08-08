#!/usr/bin/env bash
# =============================================================================
# x.sh — Auth con cookie HttpOnly (solución a largo plazo)
#
# PROBLEMA RAÍZ:
#   El token Firebase vive solo en memoria del browser (Firebase SDK).
#   Cuando el SSO redirige a /dashboard, Next.js renderiza los componentes
#   antes de que onAuthStateChanged dispare → los fetches salen sin token → 401.
#   No hay forma de "esperar" al SDK desde el middleware de Next.js.
#
# SOLUCIÓN:
#   Persistir el Firebase ID token en una cookie HttpOnly con nombre
#   __session (nombre que Firebase Hosting entiende, pero vale para cualquier host).
#   El middleware de Next.js lee esa cookie ANTES de renderizar cualquier página
#   protegida. Si no existe → redirect a /login. Si existe → la página monta
#   con la garantía de que hay token disponible.
#
#   El token se escribe en la cookie desde el cliente via un endpoint
#   /api/auth/session (Next.js Route Handler) — el único lugar que puede
#   setear cookies HttpOnly desde el browser.
#
# FLUJO COMPLETO:
#   1. SSO page: signInWithCustomToken → onAuthStateChanged resuelve →
#      POST /api/auth/session { idToken } → cookie __session seteada →
#      router.replace('/dashboard')
#   2. middleware.ts: lee __session → existe → deja pasar
#   3. Componentes montan → getCurrentUserToken() usa auth.currentUser
#      (que ya resolvió porque esperamos el onAuthStateChanged en el paso 1)
#   4. En refresh de página: Firebase SDK restaura la sesión via cookie
#      (o la cookie nos dice que hay sesión → mostramos loading hasta que SDK resuelve)
#
# ARCHIVOS CREADOS/MODIFICADOS:
#   realsass-dashboard-front/middleware.ts                    (NUEVO)
#   realsass-dashboard-front/app/api/auth/session/route.ts   (NUEVO)
#   realsass-dashboard-front/app/api/auth/logout/route.ts    (NUEVO)
#   realsass-dashboard-front/app/auth/sso/page.tsx           (MODIFICADO)
#   realsass-dashboard-front/lib/firebase.ts                 (MODIFICADO)
#   realsass-dashboard-front/lib/api-client.ts               (MODIFICADO)
#   realsass-dashboard-front/features/auth/context/auth-context.tsx (MODIFICADO)
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${YELLOW}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

ROOT="realsass-dashboard-front"
[ -d "$ROOT" ] || fail "No se encontró $ROOT/ — correr desde la raíz del monorepo"

# ─────────────────────────────────────────────────────────────────────────────
# 1) middleware.ts — guard que bloquea /dashboard/* sin cookie __session
# ─────────────────────────────────────────────────────────────────────────────
log "Creando $ROOT/middleware.ts..."

cat > "$ROOT/middleware.ts" << 'EOF'
// middleware.ts
//
// Corre en el Edge Runtime ANTES de que cualquier página se renderice.
// Lee la cookie __session que contiene el Firebase ID token.
//
// Si no existe → redirect a /login.
// Si existe   → deja pasar. El SDK de Firebase en el cliente ya tiene
//               la sesión restaurada porque la seteamos antes de navegar.
//
// IMPORTANTE: Este middleware NO verifica la firma del JWT (eso requiere
// Firebase Admin que no corre en Edge). Solo verifica presencia + expiración
// básica del token (campo exp del payload). La verificación criptográfica
// real la hacen los backends (realsass-sass-back y realsass-ecommerce-back)
// con Firebase Admin en cada request autenticado.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = '__session';

function isTokenExpired(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return true;
    // Edge Runtime tiene atob
    const payload = JSON.parse(atob(payloadB64)) as { exp?: number };
    if (!payload.exp) return true;
    // exp es en segundos, Date.now() en ms
    return Date.now() / 1000 > payload.exp;
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas que no necesitan auth — dejar pasar siempre
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||   // nuestros route handlers de sesión
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Para todo lo demás bajo /dashboard/*
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionCookie || isTokenExpired(sessionCookie)) {
    const loginUrl = new URL('/login', request.url);
    // Guardamos el destino para redirigir después del login
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Aplica solo a rutas del dashboard — no a assets estáticos ni API routes
  matcher: ['/dashboard/:path*'],
};
EOF

ok "$ROOT/middleware.ts creado"

# ─────────────────────────────────────────────────────────────────────────────
# 2) Route Handler: POST /api/auth/session — setea la cookie __session
# ─────────────────────────────────────────────────────────────────────────────
log "Creando $ROOT/app/api/auth/session/route.ts..."
mkdir -p "$ROOT/app/api/auth/session"

cat > "$ROOT/app/api/auth/session/route.ts" << 'EOF'
// app/api/auth/session/route.ts
//
// POST /api/auth/session { idToken: string }
//   Recibe el Firebase ID token desde el cliente y lo persiste en una
//   cookie HttpOnly. Llamado desde app/auth/sso/page.tsx después de
//   signInWithCustomToken, y desde auth-context después de cada login.
//
// DELETE /api/auth/session
//   Borra la cookie (logout).
//
// La cookie es HttpOnly → JS del cliente no puede leerla → más seguro.
// El middleware.ts la lee en el Edge para proteger /dashboard/*.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE  = '__session';
const ONE_HOUR_SECS   = 60 * 60;           // Firebase ID tokens duran 1 hora
const COOKIE_MAX_AGE  = ONE_HOUR_SECS - 60; // 59 min — margen para el refresh

function cookieOptions(maxAge: number) {
  return {
    httpOnly:  true,
    secure:    process.env.NODE_ENV === 'production',
    sameSite:  'lax' as const,   // 'lax' permite el redirect del SSO
    path:      '/',
    maxAge,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { idToken?: string };
    const { idToken } = body;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'idToken requerido' },
        { status: 400 },
      );
    }

    // Verificación básica: que sea un JWT de 3 partes
    if (idToken.split('.').length !== 3) {
      return NextResponse.json(
        { error: 'idToken inválido' },
        { status: 400 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, idToken, cookieOptions(COOKIE_MAX_AGE));
    return response;

  } catch {
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  return response;
}
EOF

ok "$ROOT/app/api/auth/session/route.ts creado"

# ─────────────────────────────────────────────────────────────────────────────
# 3) lib/firebase.ts — getCurrentUserToken con waitForUser + persistSession
# ─────────────────────────────────────────────────────────────────────────────
log "Sobreescribiendo $ROOT/lib/firebase.ts..."

cat > "$ROOT/lib/firebase.ts" << 'EOF'
// lib/firebase.ts — Firebase client SDK + helpers de sesión
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

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ─── Helpers de sesión (cookie HttpOnly) ─────────────────────────────────────

/**
 * Persiste el ID token en la cookie __session via el Route Handler.
 * Llamar después de signInWithCustomToken o signInWithPopup.
 */
export async function persistSession(user: User): Promise<void> {
  const idToken = await user.getIdToken();
  await fetch('/api/auth/session', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ idToken }),
  });
}

/**
 * Borra la cookie __session (logout).
 */
export async function clearSession(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' });
}

// ─── Helpers de token ────────────────────────────────────────────────────────

/**
 * Espera hasta `timeoutMs` ms a que Firebase resuelva auth.currentUser.
 * Necesario en el primer render post-SSO cuando el SDK todavía no emitió
 * onAuthStateChanged.
 */
function waitForUser(timeoutMs = 3000): Promise<User | null> {
  return new Promise((resolve) => {
    if (auth.currentUser) {
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
 * - Espera hasta 3s si auth.currentUser es null (post-SSO race condition).
 * - forceRefresh=true renueva el token contra Firebase (para retry en 401).
 * - Si el token fue renovado, actualiza la cookie automáticamente.
 */
export async function getCurrentUserToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser ?? await waitForUser();
  if (!user) throw new Error('No hay usuario autenticado');

  const token = await user.getIdToken(forceRefresh);

  // Actualizar la cookie si pedimos refresh (el token viejo expiró)
  if (forceRefresh) {
    void persistSession(user); // fire-and-forget — no bloquear el fetch
  }

  return token;
}

export { signInWithPopup, signOut, onAuthStateChanged, type User };
EOF

ok "$ROOT/lib/firebase.ts actualizado"

# ─────────────────────────────────────────────────────────────────────────────
# 4) lib/api-client.ts — retry en 401 con forceRefresh
# ─────────────────────────────────────────────────────────────────────────────
log "Sobreescribiendo $ROOT/lib/api-client.ts..."

cat > "$ROOT/lib/api-client.ts" << 'EOF'
// lib/api-client.ts
// Helpers HTTP para realsass-sass-back y realsass-ecommerce-back.
// Retry automático en 401: forceRefresh del token + reintento único.

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
  try {
    return await getCurrentUserToken(forceRefresh);
  } catch {
    return undefined;
  }
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
  const token = await getToken(_isRetry); // forceRefresh en el retry

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

  // Retry automático en 401 — solo una vez
  if (res.status === 401 && !_isRetry) {
    return coreFetch<T>(baseUrl, path, {
      method, body, orgId, signal, _isRetry: true,
    });
  }

  const json = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    const msg =
      (json['message'] as string | undefined) ??
      (json['error']   as string | undefined) ??
      `Error ${res.status}`;
    throw new Error(msg);
  }

  return ((json['data'] as T | undefined) ?? json as unknown as T);
}

// ─── realsass-sass-back ───────────────────────────────────────────────────────
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

// ─── realsass-ecommerce-back ──────────────────────────────────────────────────
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

ok "$ROOT/lib/api-client.ts actualizado"

# ─────────────────────────────────────────────────────────────────────────────
# 5) app/auth/sso/page.tsx — espera onAuthStateChanged ANTES de navegar
# ─────────────────────────────────────────────────────────────────────────────
log "Sobreescribiendo $ROOT/app/auth/sso/page.tsx..."

cat > "$ROOT/app/auth/sso/page.tsx" << 'EOF'
// app/auth/sso/page.tsx
//
// Flujo:
//   1. Lee el customToken de la URL (?token=...)
//   2. signInWithCustomToken → Firebase establece la sesión
//   3. Espera onAuthStateChanged para confirmar que user != null
//   4. getIdToken() → POST /api/auth/session → cookie __session seteada
//   5. router.replace('/dashboard')  ← ahora el middleware ve la cookie
//
// El paso 3-4 antes del redirect es la clave: garantiza que el middleware
// tenga la cookie Y que Firebase SDK tenga auth.currentUser antes de que
// cualquier componente del dashboard intente hacer un fetch.
'use client';

import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, persistSession }  from '@/lib/firebase';

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
        const credential = await signInWithCustomToken(auth, customToken);

        setMessage('Guardando sesión...');

        // 2. Persistir el ID token en la cookie HttpOnly ANTES de navegar.
        //    Esto garantiza que el middleware vea la cookie en el primer request
        //    a /dashboard, y que auth.currentUser != null cuando los componentes monten.
        await persistSession(credential.user);

        setMessage('Redirigiendo...');

        // 3. Ahora sí navegamos — el middleware tiene la cookie y el SDK tiene el user
        router.replace('/dashboard');

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido';
        console.error('[SSO] Error:', msg);
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
          <a href="/" className="text-xs text-primary underline underline-offset-2">
            Volver al inicio
          </a>
        </>
      )}
    </main>
  );
}
EOF

ok "$ROOT/app/auth/sso/page.tsx actualizado"

# ─────────────────────────────────────────────────────────────────────────────
# 6) auth-context.tsx — persistSession en login + clearSession en logout
#    + auto-refresh de la cookie cada 55 minutos
# ─────────────────────────────────────────────────────────────────────────────
log "Sobreescribiendo $ROOT/features/auth/context/auth-context.tsx..."
mkdir -p "$ROOT/features/auth/context"

cat > "$ROOT/features/auth/context/auth-context.tsx" << 'EOF'
'use client';

// =============================================================================
// auth-context.tsx — Firebase SDK + cookie __session + real-back
//
// Flujo de sesión:
//   1. Firebase SDK autentica (SSO via customToken o Google directo)
//   2. persistSession() → POST /api/auth/session → cookie HttpOnly __session
//   3. middleware.ts lee la cookie antes de servir /dashboard/*
//   4. onAuthStateChanged sincroniza con real-back para obtener organizationId
//
// Refresh automático:
//   Firebase ID tokens duran 1 hora. Cada 55 minutos:
//   - user.getIdToken(true) → nuevo token
//   - persistSession() → actualiza la cookie
//   Garantiza que el middleware nunca vea un token expirado.
// =============================================================================

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  auth, googleProvider, persistSession, clearSession,
  signInWithPopup, signOut, onAuthStateChanged, type User as FirebaseUser,
} from '@/lib/firebase';
import { realBackFetch } from '@/lib/api-client';

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
  firebaseUser:      DashboardUser | null;
  isLoading:         boolean;
  isAuthenticated:   boolean;
  organizationId:    string | null;
  setOrganizationId: (id: string) => void;
  loginWithGoogle:   () => Promise<void>;
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

const ORG_KEY            = 'dash_org_id';
const REFRESH_INTERVAL   = 55 * 60 * 1000; // 55 minutos en ms

async function syncWithRealBack(fbUser: FirebaseUser): Promise<DashboardUser | null> {
  try {
    await realBackFetch.post('/api/v1/auth/sync', {
      firebaseUid: fbUser.uid,
      email:       fbUser.email,
      displayName: fbUser.displayName,
      avatarUrl:   fbUser.photoURL,
    });

    const data = await realBackFetch.get<{
      user:           DashboardUser;
      organizationId: string | null;
    }>('/api/v1/users/me');

    return data.user;
  } catch (err) {
    console.error('[Auth] Error sincronizando con real-back:', err);
    return null;
  }
}

async function fetchOrganizationId(): Promise<string | null> {
  try {
    const data = await realBackFetch.get<{
      user:           DashboardUser;
      organizationId: string | null;
    }>('/api/v1/users/me');
    return data.organizationId ?? null;
  } catch {
    return null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]    = useState<DashboardUser | null>(null);
  const [orgId,     setOrgId]   = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const router      = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const setOrganizationId = useCallback((id: string) => {
    setOrgId(id);
    if (typeof window !== 'undefined') localStorage.setItem(ORG_KEY, id);
  }, []);

  // Auto-refresh del token + cookie cada 55 minutos
  const scheduleRefresh = useCallback((fbUser: FirebaseUser) => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(async () => {
      try {
        // forceRefresh=true renueva contra Firebase
        // persistSession() actualiza la cookie automáticamente (ver firebase.ts)
        await fbUser.getIdToken(true);
        await persistSession(fbUser);
      } catch {
        // Si el refresh falla, onAuthStateChanged disparará con null
        // y el usuario será deslogueado automáticamente
      }
    }, REFRESH_INTERVAL);
  }, []);

  const handleFirebaseUser = useCallback(async (fbUser: FirebaseUser | null) => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);

    if (!fbUser) {
      setUser(null);
      setOrgId(null);
      setLoading(false);
      return;
    }

    // Iniciar refresh automático para esta sesión
    scheduleRefresh(fbUser);

    const profile = await syncWithRealBack(fbUser);
    if (!profile) {
      setUser(null);
      setOrgId(null);
      setLoading(false);
      return;
    }

    setUser(profile);

    const stored = typeof window !== 'undefined' ? localStorage.getItem(ORG_KEY) : null;
    if (stored) {
      setOrgId(stored);
    } else {
      const remoteOrgId = await fetchOrganizationId();
      if (remoteOrgId) {
        setOrgId(remoteOrgId);
        localStorage.setItem(ORG_KEY, remoteOrgId);
      }
    }

    setLoading(false);
  }, [scheduleRefresh]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      await handleFirebaseUser(fbUser);
    });
    return () => {
      unsub();
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [handleFirebaseUser]);

  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      // Persistir la cookie ANTES de que onAuthStateChanged dispare las queries
      await persistSession(credential.user);
      // onAuthStateChanged se dispara automáticamente → handleFirebaseUser
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    // Borrar cookie + sesión Firebase
    await Promise.all([clearSession(), signOut(auth)]);
    if (typeof window !== 'undefined') localStorage.removeItem(ORG_KEY);
    setUser(null);
    setOrgId(null);
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    const profile = await syncWithRealBack(fbUser);
    if (profile) setUser(profile);
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

ok "$ROOT/features/auth/context/auth-context.tsx actualizado"

# ─────────────────────────────────────────────────────────────────────────────
# Resumen
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "  ═══════════════════════════════════════════════════════════════"
echo "  Archivos creados/modificados:"
echo ""
echo "  NUEVO    $ROOT/middleware.ts"
echo "           Lee cookie __session antes de servir /dashboard/*"
echo "           Token expirado o ausente → redirect a /login"
echo ""
echo "  NUEVO    $ROOT/app/api/auth/session/route.ts"
echo "           POST → setea cookie HttpOnly __session con el ID token"
echo "           DELETE → borra la cookie (logout)"
echo ""
echo "  MOD      $ROOT/app/auth/sso/page.tsx"
echo "           Agrega persistSession() ANTES de router.replace('/dashboard')"
echo "           Elimina el race condition: cookie existe cuando el"
echo "           middleware recibe el primer request al dashboard"
echo ""
echo "  MOD      $ROOT/lib/firebase.ts"
echo "           + persistSession(user) → POST /api/auth/session"
echo "           + clearSession() → DELETE /api/auth/session"
echo "           + getCurrentUserToken(forceRefresh) con waitForUser(3s)"
echo "           + auto-actualiza la cookie cuando forceRefresh=true"
echo ""
echo "  MOD      $ROOT/lib/api-client.ts"
echo "           + retry automático en 401 con forceRefresh del token"
echo ""
echo "  MOD      $ROOT/features/auth/context/auth-context.tsx"
echo "           + persistSession() en loginWithGoogle"
echo "           + clearSession() en logout"
echo "           + auto-refresh de cookie cada 55 minutos"
echo "  ═══════════════════════════════════════════════════════════════"
echo ""
echo "  No se requieren cambios en Railway ni en variables de entorno."
echo "  No se requieren cambios en los backends."
echo ""