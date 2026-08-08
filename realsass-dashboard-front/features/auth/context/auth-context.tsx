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
