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
