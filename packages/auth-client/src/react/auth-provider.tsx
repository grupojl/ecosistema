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
