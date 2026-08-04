'use client';

// =============================================================================
// auth-context.tsx — Firebase SDK directo + real-back
// 1 request (POST /auth/sync) — expone organizationSlug para storefront
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

interface TenantOrg {
  id:   string;
  name: string | null;
  slug: string | null;
}

interface Tenant {
  organizationId: string;
  role:           'OWNER' | 'COLLABORATOR';
  organization:   TenantOrg;
}

interface SyncResponse {
  id:          string;
  firebaseUid: string;
  email:       string;
  displayName: string | null;
  avatarUrl:   string | null;
  isOwner:     boolean;
  isAffiliate: boolean;
  createdAt:   string;
  tenants:     Tenant[];
}

interface AuthContextType {
  user:              DashboardUser | null;
  firebaseUser:      DashboardUser | null;
  isLoading:         boolean;
  isAuthenticated:   boolean;
  accessDenied:      boolean;
  organizationId:    string | null;
  organizationSlug:  string | null;
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

const ORG_KEY  = 'dash_org_id';
const SLUG_KEY = 'dash_org_slug';

async function syncWithRealBack(_fbUser: FirebaseUser): Promise<{
  profile:  DashboardUser | null;
  orgId:    string | null;
  orgSlug:  string | null;
  denied:   boolean;
}> {
  try {
    const data = await realBackFetch.post<SyncResponse>('/api/v1/auth/sync', {});
    if (!data) return { profile: null, orgId: null, orgSlug: null, denied: false };

    const profile: DashboardUser = {
      id:          data.id,
      firebaseUid: data.firebaseUid,
      email:       data.email,
      displayName: data.displayName ?? null,
      avatarUrl:   data.avatarUrl   ?? null,
      isOwner:     data.isOwner     ?? false,
      isAffiliate: data.isAffiliate ?? false,
      createdAt:   data.createdAt,
    };

    const tenants: Tenant[] = data.tenants ?? [];
    const hasAccess = profile.isOwner || tenants.length > 0;
    if (!hasAccess) return { profile: null, orgId: null, orgSlug: null, denied: true };

    const stored      = typeof window !== 'undefined' ? localStorage.getItem(ORG_KEY) : null;
    const validTenant = tenants.find(t => t.organizationId === stored) ?? tenants[0];
    const orgId       = validTenant?.organizationId ?? null;
    const orgSlug     = validTenant?.organization?.slug ?? null;

    if (orgId)   localStorage.setItem(ORG_KEY,  orgId);
    if (orgSlug) localStorage.setItem(SLUG_KEY, orgSlug);

    return { profile, orgId, orgSlug, denied: false };
  } catch (err) {
    console.error('[Auth] Error sincronizando con real-back:', err);
    return { profile: null, orgId: null, orgSlug: null, denied: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,         setUser]    = useState<DashboardUser | null>(null);
  const [orgId,        setOrgId]   = useState<string | null>(null);
  const [orgSlug,      setOrgSlug] = useState<string | null>(null);
  const [isLoading,    setLoading] = useState(true);
  const [accessDenied, setDenied]  = useState(false);
  const router      = useRouter();
  const initialized = useRef(false);

  const setOrganizationId = useCallback((id: string) => {
    setOrgId(id);
    if (typeof window !== 'undefined') localStorage.setItem(ORG_KEY, id);
  }, []);

  const handleFirebaseUser = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      setUser(null); setOrgId(null); setOrgSlug(null);
      setDenied(false); setLoading(false);
      return;
    }
    const { profile, orgId: id, orgSlug: slug, denied } = await syncWithRealBack(fbUser);
    if (denied) {
      await signOut(auth);
      setUser(null); setOrgId(null); setOrgSlug(null);
      setDenied(true); setLoading(false);
      return;
    }
    setUser(profile); setOrgId(id); setOrgSlug(slug);
    setDenied(false); setLoading(false);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      initialized.current = true;
      await handleFirebaseUser(fbUser);
    });
    return () => unsub();
  }, [handleFirebaseUser]);

  const loginWithGoogle = useCallback(async () => {
    setLoading(true); setDenied(false);
    try { await signInWithPopup(auth, googleProvider); }
    catch (err) { setLoading(false); throw err; }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ORG_KEY);
      localStorage.removeItem(SLUG_KEY);
    }
    setUser(null); setOrgId(null); setOrgSlug(null);
    setDenied(false);
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    const { profile, orgId: id, orgSlug: slug } = await syncWithRealBack(fbUser);
    if (profile) { setUser(profile); if (id) setOrgId(id); if (slug) setOrgSlug(slug); }
  }, []);

  return (
    <Ctx.Provider value={{
      user, firebaseUser: user,
      isLoading, isAuthenticated: !!user,
      accessDenied,
      organizationId: orgId, organizationSlug: orgSlug,
      setOrganizationId, loginWithGoogle, logout, refreshUser,
    }}>
      {children}
    </Ctx.Provider>
  );
}
