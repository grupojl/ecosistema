#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix auth flow dashboard-front
#
# Problema: colaboradores que hacen login directo con Google quedan en /login
#           porque syncWithRealBack los crea sin organización y el context
#           no sabe distinguir "autenticado sin acceso" de "cargando".
#
# Solución:
#   1. auth-context — después del sync, verificar si tiene acceso real
#      (isOwner || collaborations con status ACTIVE). Si no tiene acceso,
#      setear user=null y exponer error "sin acceso".
#   2. login/page.tsx — mostrar mensaje claro si el usuario no tiene
#      organización asignada en vez de quedarse en loop de carga.
# =============================================================================

set -euo pipefail
GREEN='\033[0;32m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
log() { echo -e "[→] $1"; }

# =============================================================================
# 1. auth-context.tsx
# =============================================================================
log "Reescribiendo realsass-dashboard-front/features/auth/context/auth-context.tsx ..."

cat > "realsass-dashboard-front/features/auth/context/auth-context.tsx" << 'EOF'
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
EOF

ok "auth-context.tsx actualizado"

# =============================================================================
# 2. login/page.tsx — mostrar error si accessDenied
# =============================================================================
log "Reescribiendo realsass-dashboard-front/app/login/page.tsx ..."

cat > "realsass-dashboard-front/app/login/page.tsx" << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithGoogle, isAuthenticated, isLoading, accessDenied } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      // onAuthStateChanged redirige si tiene acceso
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Logo className="h-12 w-12 text-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Iniciá sesión para acceder al panel de gestión
          </p>
        </div>

        {accessDenied && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Sin acceso</p>
              <p className="text-xs text-destructive/80">
                Tu cuenta no está asignada a ninguna organización. Pedile al owner que te invite.
              </p>
            </div>
          </div>
        )}

        <Button
          className="w-full h-11 text-base font-medium gap-3"
          onClick={handleGoogle}
          disabled={loading || isLoading}
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

ok "login/page.tsx actualizado"

# =============================================================================
# 3. features/auth/index.ts — re-exportar accessDenied si no está
# =============================================================================
INDEX="realsass-dashboard-front/features/auth/index.ts"
if ! grep -q "accessDenied" "$INDEX" 2>/dev/null; then
  log "features/auth/index.ts ya exporta AuthProvider — sin cambios necesarios"
fi

echo ""
echo "============================================================"
echo "  Resumen"
echo "============================================================"
echo "  auth-context.tsx:"
echo "    → syncWithRealBack lee tenants del perfil"
echo "    → si no tiene tenants → accessDenied=true + signOut Firebase"
echo "    → orgId se resuelve del primer tenant disponible"
echo "    → stored orgId se valida contra tenants del usuario"
echo ""
echo "  login/page.tsx:"
echo "    → muestra banner de error si accessDenied"
echo "    → spinner mientras isLoading"
echo "    → redirige al dashboard si isAuthenticated"
echo ""
echo "  IMPORTANTE: el back devuelve el perfil en GET /auth/me"
echo "  con shape { data: { user, tenants } }."
echo "  Verificar que buildProfile incluya tenants en la respuesta."
echo "============================================================"
ok "Listo. make g y Railway redeploya realsass-dashboard-front."