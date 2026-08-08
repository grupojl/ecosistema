#!/usr/bin/env bash
# x.sh — Login directo con Google en dashboard-front
# Sin depender del SSO del sass-front para entrar
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${YELLOW}▶${NC} $1"; }
ok()  { echo -e "${GREEN}✓${NC} $1"; }

ROOT="realsass-dashboard-front"
[ -d "$ROOT" ] || { echo "No se encontró $ROOT/"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# 1) lib/firebase.ts — agrega signInWithPopup y GoogleAuthProvider
# ─────────────────────────────────────────────────────────────────────────────
log "Escribiendo $ROOT/lib/firebase.ts..."
cat > "$ROOT/lib/firebase.ts" << 'EOF'
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithPopup,
  GoogleAuthProvider,
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

export function waitForAuthReady(timeoutMs = 5000): Promise<User | null> {
  return new Promise((resolve) => {
    if (auth.currentUser !== null) { resolve(auth.currentUser); return; }
    const timer = setTimeout(() => { unsub(); resolve(null); }, timeoutMs);
    const unsub = onAuthStateChanged(auth, (user) => {
      clearTimeout(timer); unsub(); resolve(user);
    });
  });
}

export async function getCurrentUserToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser ?? await waitForAuthReady();
  if (!user) throw new Error('No hay usuario autenticado');
  return user.getIdToken(forceRefresh);
}

export { signOut, onAuthStateChanged, signInWithCustomToken, signInWithPopup, type User };
EOF
ok "lib/firebase.ts listo"

# ─────────────────────────────────────────────────────────────────────────────
# 2) app/login/page.tsx — Google login directo, sin redirigir a sass-front
# ─────────────────────────────────────────────────────────────────────────────
log "Escribiendo $ROOT/app/login/page.tsx..."
mkdir -p "$ROOT/app/login"
cat > "$ROOT/app/login/page.tsx" << 'EOF'
'use client';

import { useState }      from 'react';
import { useRouter }     from 'next/navigation';
import { Loader2 }       from 'lucide-react';
import { Button }        from '@/components/ui/button';
import { Logo }          from '@/components/logo';
import { toast }         from 'sonner';
import { auth, googleProvider, signInWithPopup, waitForAuthReady } from '@/lib/firebase';
import { realBackFetch } from '@/lib/api-client';

export default function LoginPage() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      // 1. Login con Google directamente
      await signInWithPopup(auth, googleProvider);

      // 2. Esperar que Firebase confirme la sesión
      const user = await waitForAuthReady(5000);
      if (!user) throw new Error('No se pudo establecer la sesión');

      // 3. Sync con sass-back (crea el usuario si no existe)
      await realBackFetch.post('/api/v1/auth/sync', {
        firebaseUid: user.uid,
        email:       user.email,
        displayName: user.displayName,
        avatarUrl:   user.photoURL,
      });

      // 4. Verificar que tiene acceso al dashboard
      const access = await realBackFetch.get<{
        canAccess: boolean;
        role?:     string;
        reason?:   string;
      }>('/api/v1/auth/dashboard-access');

      if (!access.canAccess) {
        toast.error(access.reason ?? 'No tenés acceso al dashboard. Contactá al administrador.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      router.replace('/dashboard');

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Logo className="h-12 w-12 text-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Iniciá sesión con el Gmail de tu organización
          </p>
        </div>

        <Button
          className="w-full h-11 text-base font-medium gap-3"
          onClick={handleGoogle}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? 'Iniciando sesión...' : 'Continuar con Google'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Solo cuentas con acceso al dashboard pueden ingresar
        </p>
      </div>
    </main>
  );
}
EOF
ok "app/login/page.tsx listo"

# ─────────────────────────────────────────────────────────────────────────────
# 3) auth-context.tsx — loginWithGoogle usa signInWithPopup directo
# ─────────────────────────────────────────────────────────────────────────────
log "Escribiendo $ROOT/features/auth/context/auth-context.tsx..."
mkdir -p "$ROOT/features/auth/context"
cat > "$ROOT/features/auth/context/auth-context.tsx" << 'EOF'
'use client';

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  auth, googleProvider, signOut, onAuthStateChanged,
  signInWithPopup, type User as FirebaseUser,
} from '@/lib/firebase';
import { realBackFetch } from '@/lib/api-client';

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

const ORG_KEY = 'dash_org_id';

async function syncAndGetProfile(fbUser: FirebaseUser): Promise<{
  user: DashboardUser;
  organizationId: string | null;
} | null> {
  try {
    await realBackFetch.post('/api/v1/auth/sync', {
      firebaseUid: fbUser.uid,
      email:       fbUser.email,
      displayName: fbUser.displayName,
      avatarUrl:   fbUser.photoURL,
    });
    const data = await realBackFetch.get<{
      user: DashboardUser;
      organizationId: string | null;
    }>('/api/v1/users/me');
    return data;
  } catch (err) {
    console.error('[Auth] sync error:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]    = useState<DashboardUser | null>(null);
  const [orgId,     setOrgId]   = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const router  = useRouter();
  const didInit = useRef(false);

  const setOrganizationId = useCallback((id: string) => {
    setOrgId(id);
    if (typeof window !== 'undefined') localStorage.setItem(ORG_KEY, id);
  }, []);

  const handleFirebaseUser = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      setUser(null); setOrgId(null); setLoading(false);
      return;
    }
    const result = await syncAndGetProfile(fbUser);
    if (!result) {
      setUser(null); setOrgId(null); setLoading(false);
      return;
    }
    setUser(result.user);
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
      if (didInit.current) return;
      didInit.current = true;
      await handleFirebaseUser(fbUser);
    });
    return () => unsub();
  }, [handleFirebaseUser]);

  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged dispara handleFirebaseUser automáticamente
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    if (typeof window !== 'undefined') localStorage.removeItem(ORG_KEY);
    setUser(null); setOrgId(null);
    didInit.current = false;
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    const result = await syncAndGetProfile(fbUser);
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
ok "auth-context.tsx listo"

# ─────────────────────────────────────────────────────────────────────────────
# 4) app/auth/sso/page.tsx — sigue funcionando para el flujo desde sass-front
# ─────────────────────────────────────────────────────────────────────────────
log "Escribiendo $ROOT/app/auth/sso/page.tsx..."
mkdir -p "$ROOT/app/auth/sso"
cat > "$ROOT/app/auth/sso/page.tsx" << 'EOF'
'use client';

import { useEffect, useState }    from 'react';
import { useRouter }              from 'next/navigation';
import { Loader2, AlertCircle }   from 'lucide-react';
import { signInWithCustomToken }  from 'firebase/auth';
import { auth, waitForAuthReady } from '@/lib/firebase';

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
          setMessage('Token no encontrado.'); setState('error'); return;
        }
        setMessage('Verificando credenciales...');
        await signInWithCustomToken(auth, customToken);
        setMessage('Estableciendo sesión...');
        const user = await waitForAuthReady(5000);
        if (!user) {
          setMessage('No se pudo establecer la sesión.'); setState('error'); return;
        }
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
        <><Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p></>
      )}
      {state === 'error' && (
        <><AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive text-center max-w-xs">{message}</p>
        <a href="/login" className="text-xs text-primary underline underline-offset-2">
          Ir al login
        </a></>
      )}
    </main>
  );
}
EOF
ok "app/auth/sso/page.tsx listo"

echo ""
echo "  ════════════════════════════════════════════════════════════"
echo "  Listo. El dashboard-front ahora tiene login propio con Google."
echo ""
echo "  Flujo 1 — Login directo (dashboard-front/login):"
echo "    Google popup → sync con sass-back → verificar dashboard-access"
echo "    → /dashboard"
echo ""
echo "  Flujo 2 — SSO desde sass-front (sigue funcionando):"
echo "    Botón 'Ir al dashboard' → customToken → /auth/sso → /dashboard"
echo "  ════════════════════════════════════════════════════════════"
echo ""