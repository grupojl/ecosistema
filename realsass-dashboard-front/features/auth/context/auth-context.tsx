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
