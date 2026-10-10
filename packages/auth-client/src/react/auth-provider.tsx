'use client';

/**
 * AuthProvider compartido (dashboard-front).
 *
 * Flujo (domain/flows/owner-organizacion.md, Paso 1 y D4/D5):
 *   1. Firebase onAuthStateChanged → usuario
 *   2. auth.sync   (tRPC, Bearer)  → upsert + organización por defecto + claims
 *   3. getIdToken(true) → POST /auth/session (REST, ADR-004) → cookie HttpOnly __session
 *   4. auth.me     (tRPC, Bearer)  → perfil: organizaciones propias + colaboraciones
 *   5. recién ahora `user` queda definido: las pantallas autenticadas (tRPC por cookie) ya pueden consultar
 *
 * La organización activa viaja en el header x-organization-id; cambiarla no reemite la cookie.
 */
import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import {
  getFirebaseAuth, getIdToken, signInWithGoogle, signOut,
  onAuthStateChanged, type User as FirebaseUser,
} from '../firebase/firebase';
import { setActiveOrganizationId } from '../http/api-fetch';
import { AppError }                from '../errors/app-error';
import type { Organization, Tenant, UserProfile } from '../types/index';

interface AuthContextValue {
  user:              UserProfile | null;
  isLoading:         boolean;
  isAuthenticated:   boolean;
  organizationId:    string | null;
  setOrganizationId: (id: string) => void;
  loginWithGoogle:   () => Promise<void>;
  logout:            () => Promise<void>;
  refreshUser:       () => Promise<void>;
  /** Último error de inicio de sesión (sync / cookie / perfil), para mostrarlo en la UI. */
  authError:         string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

interface AuthProviderProps {
  children:    ReactNode;
  /** URL base del sass-back, ej: http://localhost:3020 (se tolera un sufijo /api/v1). */
  sassBackUrl: string;
}

const ORG_KEY = 'real_active_org_id';

// ── Perfil devuelto por auth.me (sass-back) ───────────────────────────────────

interface OrgSummary { id: string; name: string | null; slug: string | null }
interface MeResponse {
  user: {
    id: string; firebaseUid: string; email: string | null; displayName: string | null;
    photoUrl: string | null; referralCode: string | null; createdAt: string; updatedAt: string;
  };
  organization:   OrgSummary | null;
  organizations:  OrgSummary[];
  collaborations: Array<{ organizationId: string; role: string; permissions: Record<string, boolean> }>;
}

function baseUrl(sassBackUrl: string): string {
  return sassBackUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
}

function toOrganization(o: OrgSummary): Organization {
  return {
    id: o.id, name: o.name, slug: o.slug,
    description: null, logoUrl: null, website: null, phone: null, address: null,
  };
}

function toUserProfile(me: MeResponse): UserProfile {
  const owned: Tenant[] = me.organizations.map((o) => ({
    organizationId: o.id,
    organization:   toOrganization(o),
    role:           'OWNER',
    permissions:    {},
  }));
  const collaborating: Tenant[] = me.collaborations
    .filter((c) => !me.organizations.some((o) => o.id === c.organizationId))
    .map((c) => ({
      organizationId: c.organizationId,
      organization:   toOrganization({ id: c.organizationId, name: null, slug: null }),
      role:           'MEMBER',
      permissions:    c.permissions,
    }));

  return {
    id:            me.user.id,
    firebaseUid:   me.user.firebaseUid,
    email:         me.user.email ?? '',
    displayName:   me.user.displayName,
    avatarUrl:     me.user.photoUrl,
    isOwner:       owned.length > 0,
    isAffiliate:   false,
    affiliateCode: me.user.referralCode,
    createdAt:     me.user.createdAt,
    updatedAt:     me.user.updatedAt,
    organization:  me.organization ? toOrganization(me.organization) : null,
    tenants:       [...owned, ...collaborating],
    affiliateData: null,
  };
}

// ── Llamadas al back ──────────────────────────────────────────────────────────

async function trpcCall<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AppError('NETWORK', 'Sin conexión con el servidor.');
  }
  if (res.status === 401) throw new AppError('AUTH', 'Sesión inválida o vencida.');
  if (!res.ok) throw new AppError('SERVER', `El servidor respondió ${res.status}.`);
  const body = await res.json() as { result?: { data?: T } };
  if (body.result?.data === undefined) throw new AppError('SERVER', 'Respuesta inesperada del servidor.');
  return body.result.data;
}

/** true solo si el back confirmó la cookie (ADR-004). */
async function createSessionCookie(base: string, idToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/auth/session`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function AuthProvider({ children, sassBackUrl }: AuthProviderProps) {
  const base = baseUrl(sassBackUrl);

  const [user,      setUser]      = useState<UserProfile | null>(null);
  const [orgId,     setOrgId]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const refreshTimer              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orgIdRef                  = useRef<string | null>(null);

  const applyOrg = useCallback((id: string | null) => {
    orgIdRef.current = id;
    setOrgId(id);
    setActiveOrganizationId(id);
    try {
      if (id) sessionStorage.setItem(ORG_KEY, id);
      else sessionStorage.removeItem(ORG_KEY);
    } catch { /* storage bloqueado: la org activa vive solo en memoria */ }
  }, []);

  /** La org guardada si el usuario aún tiene acceso; si no, la primera. */
  const pickOrg = useCallback((profile: UserProfile): string | null => {
    let stored: string | null = null;
    try { stored = sessionStorage.getItem(ORG_KEY); } catch { /* ignorar */ }
    const ids = profile.tenants.map((t) => t.organizationId);
    if (stored && ids.includes(stored)) return stored;
    return ids[0] ?? null;
  }, []);

  // Refresh proactivo a los 55 min: token nuevo + cookie nueva
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      try {
        const auth = getFirebaseAuth();
        if (auth.currentUser) {
          const fresh = await auth.currentUser.getIdToken(true);
          await createSessionCookie(base, fresh);
          scheduleRefresh();
        }
      } catch { /* el usuario cerró sesión */ }
    }, 55 * 60 * 1_000);
  }, [base]);

  const loadProfile = useCallback(async (): Promise<UserProfile> => {
    const token = await getIdToken(true);
    const me = await trpcCall<MeResponse>(`${base}/api/v1/trpc/auth.me`, token);
    return toUserProfile(me);
  }, [base]);

  const syncAndLoad = useCallback(async (fbUser: FirebaseUser) => {
    // 1) alta/actualización + organización por defecto + claims
    const token = await fbUser.getIdToken();
    await trpcCall<{ ok: boolean }>(`${base}/api/v1/trpc/auth.sync`, token, {
      method: 'POST', body: JSON.stringify({}),
    });

    // 2) cookie de sesión, con el token ya con claims
    const fresh = await fbUser.getIdToken(true);
    if (!(await createSessionCookie(base, fresh))) {
      throw new AppError('SERVER', 'No pudimos iniciar tu sesión segura. Intentá de nuevo.');
    }

    // 3) perfil — y solo entonces el usuario queda autenticado
    const profile = await loadProfile();
    applyOrg(pickOrg(profile));
    setUser(profile);
    scheduleRefresh();
  }, [base, loadProfile, applyOrg, pickOrg, scheduleRefresh]);

  useEffect(() => {
    const auth        = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        setUser(null);
        applyOrg(null);
        setIsLoading(false);
        return;
      }
      setAuthError(null);
      setIsLoading(true); // evita que el layout lo mande a /login mientras se prepara la sesión
      try {
        await syncAndLoad(fbUser);
      } catch (error) {
        setUser(null);
        if (error instanceof AppError && error.code === 'AUTH') {
          await signOut();
        } else {
          setAuthError(error instanceof Error ? error.message : 'No pudimos iniciar sesión.');
        }
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [syncAndLoad, applyOrg]);

  const setOrganizationId = useCallback((id: string) => applyOrg(id), [applyOrg]);

  const loginWithGoogle = useCallback(async () => { await signInWithGoogle(); }, []);

  const logout = useCallback(async () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    try {
      await fetch(`${base}/auth/session`, { method: 'DELETE', credentials: 'include' });
    } catch { /* si el back no responde, igual se cierra la sesión local */ }
    await signOut();
    applyOrg(null);
    setUser(null);
  }, [base, applyOrg]);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await loadProfile();
      setUser(profile);
      const ids = profile.tenants.map((t) => t.organizationId);
      if (!orgIdRef.current || !ids.includes(orgIdRef.current)) applyOrg(pickOrg(profile));
    } catch { /* silencioso: se conserva el perfil anterior */ }
  }, [loadProfile, applyOrg, pickOrg]);

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      isAuthenticated:   !!user,
      organizationId:    orgId,
      setOrganizationId,
      loginWithGoogle,
      logout,
      refreshUser,
      authError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
