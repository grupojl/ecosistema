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
 * Sesión compartida entre fronts: la cookie __session es la fuente de verdad (ADR-004). El usuario de
 * Firebase vive por origen (IndexedDB) y NO se comparte entre fronts. Si Firebase no tiene usuario pero
 * la cookie sigue válida (login hecho en otro front del ecosistema), se autentica con auth.me por cookie:
 * sin pasar por Google y sin refresh proactivo (la cookie vence a los 14 días; ahí se pide login).
 *
 * Tiempo real entre fronts: useSessionWatch revalida (auth.ping) al volver a la pestaña y cada ~30 s.
 * Si otro front cerró la sesión, este se desloguea; si otro front la abrió, este entra solo.
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
import { pingSession }             from '../http/ping-session';
import { sessionRefreshDue, markSessionRefreshed, clearSessionRefreshed } from '../http/session-refresh';
import { useSessionWatch, notifySessionChange } from './use-session-watch';
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

/** Con `token` va como Bearer; sin token autentica la cookie HttpOnly (credentials: include). */
async function trpcCall<T>(url: string, token: string | null, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'include',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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
  const userRef                   = useRef<UserProfile | null>(null);
  const syncingRef                = useRef(false); // login/sync en curso: no revalidar encima
  userRef.current                 = user;

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
          if (await createSessionCookie(base, fresh)) markSessionRefreshed();
          scheduleRefresh();
        }
      } catch { /* el usuario cerró sesión */ }
    }, 55 * 60 * 1_000);
  }, [base]);

  const fetchMe = useCallback(async (token: string | null): Promise<UserProfile> => {
    const me = await trpcCall<MeResponse>(`${base}/api/v1/trpc/auth.me`, token);
    return toUserProfile(me);
  }, [base]);

  const loadProfile = useCallback(async (): Promise<UserProfile> => {
    // Sin usuario de Firebase en este origen, el perfil se pide con la cookie compartida.
    const token = getFirebaseAuth().currentUser ? await getIdToken(true) : null;
    return fetchMe(token);
  }, [fetchMe]);

  /** Sesión iniciada en otro front: perfil por cookie. null si no hay cookie válida. */
  const loadProfileFromCookie = useCallback(async (): Promise<UserProfile | null> => {
    try {
      return await fetchMe(null); // SOLO cookie: nunca Bearer, así confirma que la cookie vale
    } catch {
      return null; // 401 (sin sesión), red caída o back no disponible: se muestra el login
    }
  }, [fetchMe]);

  const syncAndLoad = useCallback(async (fbUser: FirebaseUser) => {
    // Recarga (F5) con la cookie renovada hace poco: 1 request en vez de toda la cadena (y sin tocar el límite
    // de 10/min de POST /auth/session).
    if (!sessionRefreshDue()) {
      const viaCookie = await loadProfileFromCookie();
      if (viaCookie) {
        applyOrg(pickOrg(viaCookie));
        setUser(viaCookie);
        scheduleRefresh();
        return;
      }
    }

    // 1) alta/actualización + organización por defecto + claims
    const token = await fbUser.getIdToken();
    await trpcCall<{ ok: boolean }>(`${base}/api/v1/trpc/auth.sync`, token, {
      method: 'POST', body: JSON.stringify({}),
    });

    // 2) cookie de sesión, con el token ya con claims
    const fresh = await fbUser.getIdToken(true);
    if (await createSessionCookie(base, fresh)) {
      markSessionRefreshed();
    } else if (!(await loadProfileFromCookie())) {
      // Falló (p. ej. 429 por el límite) y además no hay una cookie válida previa.
      throw new AppError('SERVER', 'No pudimos iniciar tu sesión segura. Intentá de nuevo.');
    }

    // 3) perfil — y solo entonces el usuario queda autenticado
    const profile = await loadProfile();
    applyOrg(pickOrg(profile));
    setUser(profile);
    scheduleRefresh();
  }, [base, loadProfile, loadProfileFromCookie, applyOrg, pickOrg, scheduleRefresh]);

  useEffect(() => {
    const auth        = getFirebaseAuth();
    let   cancelled   = false;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      syncingRef.current = true;
      try {
      if (!fbUser) {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        if (!userRef.current) setIsLoading(true); // evita mandar a /login mientras se consulta la cookie (sin parpadeo si ya hay sesión)
        const profile = await loadProfileFromCookie();
        if (cancelled) return;
        if (profile) {
          applyOrg(pickOrg(profile));
          setUser(profile);
        } else {
          setUser(null);
          applyOrg(null);
        }
        setIsLoading(false);
        return;
      }
      setAuthError(null);
      if (!userRef.current) setIsLoading(true); // evita mandar a /login mientras se prepara la sesión (la cookie ya la puede haber abierto)
      try {
        await syncAndLoad(fbUser);
        notifySessionChange(); // otras pestañas de este origen
      } catch (error) {
        if (error instanceof AppError && error.code === 'AUTH') {
          setUser(null);
          await signOut();
        } else if (!userRef.current) {
          // Si la cookie ya abrió la sesión, un fallo del sync en segundo plano no la cierra.
          setUser(null);
          setAuthError(error instanceof Error ? error.message : 'No pudimos iniciar sesión.');
        }
      } finally {
        setIsLoading(false);
      }
      } finally {
        syncingRef.current = false;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [syncAndLoad, loadProfileFromCookie, applyOrg, pickOrg]);

  /** auth.ping: refleja un login/logout hecho en otro front. Un corte de red no desloguea a nadie. */
  const revalidate = useCallback(async () => {
    if (syncingRef.current) return;
    const status = await pingSession(sassBackUrl);
    if (syncingRef.current || status === 'unknown') return;

    if (status === 'closed' && userRef.current) {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      setUser(null);
      applyOrg(null);
      clearSessionRefreshed();
      await signOut().catch(() => undefined); // el usuario de Firebase de este origen también
    } else if (status === 'open' && !userRef.current) {
      const profile = await loadProfileFromCookie();
      if (profile && !syncingRef.current && !userRef.current) {
        applyOrg(pickOrg(profile));
        setUser(profile);
      }
    }
  }, [sassBackUrl, applyOrg, pickOrg, loadProfileFromCookie]);

  useSessionWatch(revalidate);

  // Arranque rápido: con cookie válida el perfil sale en 1 request, sin esperar la cadena sync → token → cookie → me
  // de Firebase (que sigue en segundo plano y renueva la cookie).
  useEffect(() => {
    let cancelled = false;
    void loadProfileFromCookie().then((profile) => {
      if (cancelled || !profile || userRef.current) return;
      applyOrg(pickOrg(profile));
      setUser(profile);
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadProfileFromCookie, applyOrg, pickOrg]);

  const setOrganizationId = useCallback((id: string) => applyOrg(id), [applyOrg]);

  const loginWithGoogle = useCallback(async () => { await signInWithGoogle(); }, []);

  const logout = useCallback(async () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    try {
      await fetch(`${base}/auth/session`, { method: 'DELETE', credentials: 'include' });
    } catch { /* si el back no responde, igual se cierra la sesión local */ }
    await signOut();
    clearSessionRefreshed();
    applyOrg(null);
    setUser(null);
    notifySessionChange();
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
