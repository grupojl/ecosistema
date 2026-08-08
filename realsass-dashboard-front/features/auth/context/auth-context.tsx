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
