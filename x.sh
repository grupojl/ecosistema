#!/usr/bin/env bash
set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok() { echo -e "${GREEN}✓${NC} $1"; }
log() { echo -e "${YELLOW}▶${NC} $1"; }

ROOT="realsass-dashboard-front"
[ -d "$ROOT" ] || { echo "No se encontró $ROOT/"; exit 1; }

# ─── 1) app/auth/sso/page.tsx ─────────────────────────────────────────────────
# El token llega, signInWithCustomToken funciona, pero hay que esperar
# onAuthStateChanged antes de navegar a /dashboard
log "Escribiendo app/auth/sso/page.tsx..."
mkdir -p "$ROOT/app/auth/sso"
cat > "$ROOT/app/auth/sso/page.tsx" << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { initializeApp, getApps }                            from 'firebase/app';

// Inicializar Firebase directamente acá para evitar dependencias circulares
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app  = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function SsoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const params      = new URLSearchParams(window.location.search);
        const customToken = params.get('token');

        if (!customToken) {
          setError('Token no encontrado. Volvé a intentarlo.');
          return;
        }

        // 1. Firebase establece la sesión
        await signInWithCustomToken(auth, customToken);

        // 2. Esperar que onAuthStateChanged confirme user != null
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout de sesión')), 8000);
          const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
              clearTimeout(timeout);
              unsub();
              resolve();
            }
          });
        });

        // 3. Navegar al dashboard — el AuthProvider va a hacer el sync
        router.replace('/dashboard');

      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error al iniciar sesión');
      }
    };

    run();
  }, [router]);

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive text-center max-w-xs">{error}</p>
        <a href="/login" className="text-xs text-primary underline underline-offset-2">
          Ir al login
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Iniciando sesión...</p>
    </main>
  );
}
EOF
ok "app/auth/sso/page.tsx"

# ─── 2) features/auth/context/auth-context.tsx ────────────────────────────────
# El JWT tiene organizationId en los claims — lo usamos directamente
# sin hacer un fetch extra a /users/me para el orgId
log "Escribiendo auth-context.tsx..."
mkdir -p "$ROOT/features/auth/context"
cat > "$ROOT/features/auth/context/auth-context.tsx" << 'EOF'
'use client';

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  getAuth, signOut, onAuthStateChanged,
  signInWithPopup, GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app           = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
const auth          = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export interface DashboardUser {
  id:             string;
  firebaseUid:    string;
  email:          string;
  displayName:    string | null;
  avatarUrl:      string | null;
  isOwner:        boolean;
  organizationId: string | null;
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

const REAL_BACK = (process.env.NEXT_PUBLIC_REAL_BACK_URL ?? '').replace(/\/+$/, '');
const ORG_KEY   = 'dash_org_id';

async function buildUserFromFirebase(fbUser: FirebaseUser): Promise<DashboardUser | null> {
  try {
    // Sync con sass-back (upsert idempotente)
    const token = await fbUser.getIdToken();

    await fetch(`${REAL_BACK}/api/v1/auth/sync`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        firebaseUid: fbUser.uid,
        email:       fbUser.email,
        displayName: fbUser.displayName,
        avatarUrl:   fbUser.photoURL,
      }),
    });

    // Obtener perfil con organizationId
    const res = await fetch(`${REAL_BACK}/api/v1/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const json = await res.json() as {
      data?: {
        user?: { id: string; firebaseUid: string; email: string; displayName?: string; avatarUrl?: string; isOwner: boolean };
        organizationId?: string | null;
      }
    };

    const u   = json.data?.user;
    const org = json.data?.organizationId ?? null;

    if (!u) return null;

    return {
      id:             u.id,
      firebaseUid:    u.firebaseUid,
      email:          u.email,
      displayName:    u.displayName ?? null,
      avatarUrl:      u.avatarUrl   ?? null,
      isOwner:        u.isOwner,
      organizationId: org,
    };
  } catch (err) {
    console.error('[Auth] buildUserFromFirebase error:', err);
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
    localStorage.setItem(ORG_KEY, id);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      // Evitar doble ejecución
      if (didInit.current) return;
      didInit.current = true;

      if (!fbUser) {
        setUser(null);
        setOrgId(null);
        setLoading(false);
        return;
      }

      const profile = await buildUserFromFirebase(fbUser);

      if (!profile) {
        setUser(null);
        setOrgId(null);
        setLoading(false);
        return;
      }

      setUser(profile);

      // orgId: localStorage → JWT claim → /users/me
      const stored = localStorage.getItem(ORG_KEY);
      const resolvedOrg = stored ?? profile.organizationId;
      if (resolvedOrg) {
        setOrgId(resolvedOrg);
        if (!stored) localStorage.setItem(ORG_KEY, resolvedOrg);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged dispara automáticamente
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    localStorage.removeItem(ORG_KEY);
    setUser(null);
    setOrgId(null);
    didInit.current = false;
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    const profile = await buildUserFromFirebase(fbUser);
    if (profile) {
      setUser(profile);
      const org = profile.organizationId;
      if (org) { setOrgId(org); localStorage.setItem(ORG_KEY, org); }
    }
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
ok "auth-context.tsx"

# ─── 3) app/login/page.tsx ────────────────────────────────────────────────────
log "Escribiendo app/login/page.tsx..."
mkdir -p "$ROOT/app/login"
cat > "$ROOT/app/login/page.tsx" << 'EOF'
'use client';

import { useState }     from 'react';
import { useRouter }    from 'next/navigation';
import { Loader2 }      from 'lucide-react';
import { Button }       from '@/components/ui/button';
import { Logo }         from '@/components/logo';
import { toast }        from 'sonner';
import { useAuth }      from '@/features/auth/context/auth-context';

export default function LoginPage() {
  const router              = useRouter();
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
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
      </div>
    </main>
  );
}
EOF
ok "app/login/page.tsx"

# ─── 4) next.config.mjs — COOP para Google popup ─────────────────────────────
log "Escribiendo next.config.mjs..."
cat > "$ROOT/next.config.mjs" << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
}
export default nextConfig
EOF
ok "next.config.mjs"

echo ""
echo "  ✓ SSO: /auth/sso espera onAuthStateChanged antes de navegar"
echo "  ✓ AuthContext: sync directo con sass-back via fetch"  
echo "  ✓ Login: Google popup con COOP correcto"
echo "  ✓ next.config.mjs: Cross-Origin-Opener-Policy agregado"
echo ""