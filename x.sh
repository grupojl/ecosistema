#!/usr/bin/env bash
# =============================================================================
# x.sh — Ecommerce multitenant en dashboard-front
#
# Cambios:
#   1. realsass-sass-back: buildProfile incluye slug en el select de organization
#   2. realsass-dashboard-front auth-context: expone organizationSlug
#   3. realsass-dashboard-front config/navigation: Preview → link externo al storefront
#   4. realsass-dashboard-front sidebar: link "Ver tienda" abre storefront en nueva tab
# =============================================================================

set -euo pipefail
GREEN='\033[0;32m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
log() { echo -e "[→] $1"; }

# =============================================================================
# 1. realsass-sass-back — agregar slug al select de organization en buildProfile
#    El select actual no incluye slug ni enabledProducts — el front no puede
#    construir el link al storefront sin el slug.
# =============================================================================
log "Actualizando realsass-sass-back/src/users/users.service.ts ..."

# Reemplazar el select de organization en las collaborations para incluir slug
python3 - << 'PYEOF'
import re

path = 'realsass-sass-back/src/users/users.service.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """            organization: {
              select: {
                id:          true,
                name:        true,
                logoUrl:     true,
                description: true,
                website:     true,
                phone:       true,
                address:     true,
                userId:      true,
                createdAt:   true,
                updatedAt:   true,
              },
            },"""

new = """            organization: {
              select: {
                id:              true,
                name:            true,
                slug:            true,
                enabledProducts: true,
                logoUrl:         true,
                description:     true,
                website:         true,
                phone:           true,
                address:         true,
                userId:          true,
                createdAt:       true,
                updatedAt:       true,
              },
            },"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK — slug agregado al select de organization")
else:
    print("MISS — patrón no encontrado, verificar manualmente")
PYEOF

ok "users.service.ts actualizado"

# =============================================================================
# 2. realsass-dashboard-front auth-context — exponer organizationSlug
# =============================================================================
log "Reescribiendo realsass-dashboard-front/features/auth/context/auth-context.tsx ..."

cat > "realsass-dashboard-front/features/auth/context/auth-context.tsx" << 'EOF'
'use client';

// =============================================================================
// auth-context.tsx — Firebase SDK directo + real-back
//
// Flujo optimizado: 1 solo request (POST /auth/sync devuelve perfil + tenants).
// Expone organizationSlug para construir links al storefront multitenant.
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

interface TenantOrganization {
  id:   string;
  name: string | null;
  slug: string | null;
}

interface Tenant {
  organizationId: string;
  role:           'OWNER' | 'COLLABORATOR';
  organization:   TenantOrganization;
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
  organizationSlug:  string | null;   // ← para construir link al storefront
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

// ─── Helper ───────────────────────────────────────────────────────────────────

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

    // Resolver orgId activo: localStorage si sigue siendo tenant válido
    const stored     = typeof window !== 'undefined' ? localStorage.getItem(ORG_KEY) : null;
    const validTenant = tenants.find(t => t.organizationId === stored) ?? tenants[0];
    const orgId      = validTenant?.organizationId ?? null;
    const orgSlug    = validTenant?.organization?.slug ?? null;

    if (orgId)   localStorage.setItem(ORG_KEY,  orgId);
    if (orgSlug) localStorage.setItem(SLUG_KEY, orgSlug);

    return { profile, orgId, orgSlug, denied: false };
  } catch (err) {
    console.error('[Auth] Error sincronizando con real-back:', err);
    return { profile: null, orgId: null, orgSlug: null, denied: false };
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

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

    const { profile, orgId: resolvedId, orgSlug: resolvedSlug, denied } =
      await syncWithRealBack(fbUser);

    if (denied) {
      await signOut(auth);
      setUser(null); setOrgId(null); setOrgSlug(null);
      setDenied(true); setLoading(false);
      return;
    }

    setUser(profile);
    setOrgId(resolvedId);
    setOrgSlug(resolvedSlug);
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
    setLoading(true); setDenied(false);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setLoading(false);
      throw err;
    }
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
      user,
      firebaseUser:     user,
      isLoading,
      isAuthenticated:  !!user,
      accessDenied,
      organizationId:   orgId,
      organizationSlug: orgSlug,
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

ok "auth-context.tsx actualizado — expone organizationSlug"

# =============================================================================
# 3. config/navigation.ts — Preview usa href especial que el sidebar resuelve
# =============================================================================
log "Actualizando realsass-dashboard-front/config/navigation.ts ..."

cat > "realsass-dashboard-front/config/navigation.ts" << 'EOF'
// navigation.ts
// href especial "__storefront__" es interceptado por el sidebar
// para construir el link dinámico al storefront de la org activa.

export const NAV_GROUPS = [
  {
    label: 'Tienda',
    items: [
      { name: 'Productos',  href: '/dashboard/tienda/productos', icon: 'Package',     active: true },
      { name: 'Pedidos',    href: '/dashboard/tienda/pedidos',   icon: 'ShoppingBag', active: true },
      { name: 'Ver tienda', href: '__storefront__',              icon: 'ExternalLink', active: true },
    ],
  },
  {
    label: 'Módulos',
    items: [
      { name: 'Chat IA',  href: '/dashboard/chat',     icon: 'MessageSquare', active: false },
      { name: 'Pagos',    href: '/dashboard/pagos',    icon: 'CreditCard',    active: false },
      { name: 'Campañas', href: '/dashboard/campanas', icon: 'TrendingUp',    active: false },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { name: 'Tema visual',   href: '/dashboard/configuracion/tema',     icon: 'Palette',    active: true },
      { name: 'Feature Flags', href: '/dashboard/configuracion/flags',    icon: 'ToggleLeft', active: true },
      { name: 'Webhooks',      href: '/dashboard/configuracion/webhooks', icon: 'Webhook',    active: true },
      { name: 'Quotas',        href: '/dashboard/configuracion/quotas',   icon: 'BarChart2',  active: true },
    ],
  },
] as const;
EOF

ok "navigation.ts actualizado"

# =============================================================================
# 4. dashboard-sidebar.tsx — resuelve __storefront__ al link real
# =============================================================================
log "Reescribiendo realsass-dashboard-front/components/layout/dashboard-sidebar.tsx ..."

cat > "realsass-dashboard-front/components/layout/dashboard-sidebar.tsx" << 'EOF'
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Package, ShoppingBag, ExternalLink,
  MessageSquare, CreditCard, TrendingUp,
  Palette, ToggleLeft, Webhook, BarChart2,
  LogOut, ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { siteConfig } from '@/config/site';
import { NAV_GROUPS } from '@/config/navigation';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  Package, ShoppingBag, ExternalLink,
  MessageSquare, CreditCard, TrendingUp,
  Palette, ToggleLeft, Webhook, BarChart2,
};

const STORE_FRONT_URL =
  (process.env.NEXT_PUBLIC_STORE_FRONT_URL ?? '').replace(/\/+$/, '');

export function DashboardSidebar() {
  const pathname                            = usePathname();
  const { user, logout, organizationSlug } = useAuth();
  const [menuOpen, setMenuOpen]             = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);

  // Resuelve href especiales
  const resolveHref = (href: string): string => {
    if (href === '__storefront__') {
      if (!organizationSlug || !STORE_FRONT_URL) return '#';
      return `${STORE_FRONT_URL}/tienda/${organizationSlug}`;
    }
    return href;
  };

  const isExternal = (href: string) => href === '__storefront__';

  return (
    <aside className="hidden md:flex flex-col w-60 border-r border-border bg-sidebar h-screen sticky top-0 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-sidebar-border">
        <span className="font-semibold text-sm text-sidebar-foreground">{siteConfig.name}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon     = ICON_MAP[item.icon] ?? Package;
                const href     = resolveHref(item.href);
                const external = isExternal(item.href);
                const active   = !external && isActive(item.href);
                const disabled = !item.active || (item.href === '__storefront__' && !organizationSlug);

                return (
                  <li key={item.href}>
                    {external ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
                          disabled
                            ? 'opacity-50 pointer-events-none text-sidebar-foreground/70'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.name}
                        <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                      </a>
                    ) : (
                      <Link
                        href={href}
                        className={cn(
                          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                          !item.active && 'opacity-50 pointer-events-none',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.name}
                        {!item.active && (
                          <span className="ml-auto text-[9px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            Pronto
                          </span>
                        )}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      {user && (
        <div className="border-t border-sidebar-border px-3 py-3">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 w-full rounded-md px-2 py-1.5 hover:bg-sidebar-accent transition-colors"
          >
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {user.displayName ?? user.email}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div className="mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
              {organizationSlug && STORE_FRONT_URL && (
                <a
                  href={`${STORE_FRONT_URL}/tienda/${organizationSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver tienda
                </a>
              )}
              <button
                onClick={logout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
EOF

ok "dashboard-sidebar.tsx actualizado"

echo ""
echo "============================================================"
echo "  Resumen de cambios"
echo "============================================================"
echo "  realsass-sass-back/src/users/users.service.ts"
echo "    → select de organization en collaborations incluye slug"
echo ""
echo "  realsass-dashboard-front/features/auth/context/auth-context.tsx"
echo "    → expone organizationSlug resuelto del tenant activo"
echo ""
echo "  realsass-dashboard-front/config/navigation.ts"
echo "    → 'Ver tienda' usa href especial '__storefront__'"
echo ""
echo "  realsass-dashboard-front/components/layout/dashboard-sidebar.tsx"
echo "    → resuelve '__storefront__' → STORE_FRONT_URL/tienda/{slug}"
echo "    → link externo con target=_blank"
echo "    → también aparece en el menú de usuario"
echo ""
echo "  Variable requerida en Railway → realsass-dashboard-front:"
echo "    NEXT_PUBLIC_STORE_FRONT_URL=https://ecommerce-front.up.railway.app"
echo "============================================================"
ok "Listo. make g → redeploya sass-back + dashboard-front."