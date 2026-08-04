'use client';

// =============================================================================
// auth-context.tsx — Firebase SDK directo + real-back
//
// Flujo login directo (colaborador desde /login):
//   1. signInWithPopup → Firebase autentica
//   2. onAuthStateChanged → syncWithRealBack
//   3. POST /auth/sync → crea/actualiza usuario en DB
//   4. GET /auth/me → devuelve perfil con tenants
//   5. Si no tiene tenants (ni owner ni collaborator activo) → acceso denegado
//   6. Si tiene tenants → setUser + setOrgId → redirect al dashboard
//
// Flujo SSO (desde sass-front):
//   1. signInWithCustomToken → Firebase autentica
//   2. Mismo flujo desde paso 2
// =============================================================================

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  auth, googleProvider, signInWithPopup, signOut,
  onAuthStateChanged, type User as FirebaseUser,
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
  accessDenied:      boolean;       // autenticado en Firebase pero sin org asignada
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

// ─── Tipos internos del perfil del back ──────────────────────────────────────

interface Tenant {
  organizationId: string;
  role:           'OWNER' | 'COLLABORATOR';
}

interface ProfileResponse extends DashboardUser {
  tenants: Tenant[];
}

const ORG_KEY = 'dash_org_id';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function syncWithRealBack(fbUser: FirebaseUser): Promise<{
  profile:  DashboardUser | null;
  orgId:    string | null;
  denied:   boolean;
}> {
  try {
    // 1. Sync idempotente — crea el usuario si no existe
    await realBackFetch.post('/api/v1/auth/sync', {});

    // 2. Perfil completo con tenants
    // GET /auth/me → api-client desenvuelve { success, data } → devuelve data directamente
    // data ES el perfil: { id, firebaseUid, email, isOwner, tenants, ... }
    const data = await realBackFetch.get<ProfileResponse>(`/api/v1/auth/me`);
    const profile: DashboardUser | null = data
      ? {
          id:          data.id,
          firebaseUid: data.firebaseUid,
          email:       data.email,
          displayName: data.displayName ?? null,
          avatarUrl:   data.avatarUrl   ?? null,
          isOwner:     data.isOwner     ?? false,
          isAffiliate: data.isAffiliate ?? false,
          createdAt:   data.createdAt,
        }
      : null;

    if (!profile) return { profile: null, orgId: null, denied: false };

    // 3. Determinar si tiene acceso real al dashboard
    const tenants: Tenant[] = data?.tenants ?? [];
    const hasAccess = profile.isOwner || tenants.length > 0;

    if (!hasAccess) {
      // Autenticado en Firebase pero sin organización asignada
      return { profile: null, orgId: null, denied: true };
    }

    // 4. Resolver organizationId: localStorage → primer tenant disponible
    const stored = typeof window !== 'undefined' ? localStorage.getItem(ORG_KEY) : null;
    // Verificar que el stored orgId siga siendo válido para este usuario
    const validStored = stored && tenants.some(t => t.organizationId === stored);
    const orgId = validStored ? stored : (tenants[0]?.organizationId ?? null);

    if (orgId) localStorage.setItem(ORG_KEY, orgId);

    return { profile, orgId, denied: false };
  } catch (err) {
    console.error('[Auth] Error sincronizando con real-back:', err);
    return { profile: null, orgId: null, denied: false };
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]       = useState<DashboardUser | null>(null);
  const [orgId,       setOrgId]      = useState<string | null>(null);
  const [isLoading,   setLoading]    = useState(true);
  const [accessDenied, setDenied]    = useState(false);
  const router      = useRouter();
  const initialized = useRef(false);

  const setOrganizationId = useCallback((id: string) => {
    setOrgId(id);
    if (typeof window !== 'undefined') localStorage.setItem(ORG_KEY, id);
  }, []);

  const handleFirebaseUser = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      setUser(null);
      setOrgId(null);
      setDenied(false);
      setLoading(false);
      return;
    }

    const { profile, orgId: resolvedOrgId, denied } = await syncWithRealBack(fbUser);

    if (denied) {
      // Cerrar sesión de Firebase también para que no quede en estado zombie
      await signOut(auth);
      setUser(null);
      setOrgId(null);
      setDenied(true);
      setLoading(false);
      return;
    }

    setUser(profile);
    setOrgId(resolvedOrgId);
    setDenied(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      initialized.current = true;
      await handleFirebaseUser(fbUser);
    });
    return () => unsub();
  }, [handleFirebaseUser]);

  const loginWithGoogle = useCallback(async () => {
    setLoading(true);
    setDenied(false);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged maneja el resto
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    if (typeof window !== 'undefined') localStorage.removeItem(ORG_KEY);
    setUser(null);
    setOrgId(null);
    setDenied(false);
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    const { profile, orgId: resolvedOrgId } = await syncWithRealBack(fbUser);
    if (profile) {
      setUser(profile);
      if (resolvedOrgId) setOrgId(resolvedOrgId);
    }
  }, []);

  return (
    <Ctx.Provider value={{
      user,
      firebaseUser:    user,
      isLoading,
      isAuthenticated: !!user,
      accessDenied,
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
