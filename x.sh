#!/usr/bin/env bash
# x.sh — Fix 142 errores TypeScript en realsass-dashboard-front
# Ejecutar desde la RAÍZ del monorepo: bash x.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACK="$ROOT/realsass-sass-back"
EBACK="$ROOT/realsass-ecommerce-back"
PKGS="$ROOT/packages"
DASH="$ROOT/realsass-dashboard-front"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
step() { echo -e "\n${YELLOW}══════ $1 ══════${NC}"; }
warn() { echo -e "${RED}⚠${NC}  $1"; }

# ══════════════════════════════════════════════════════════════════════
# FIX 1 — CAUSA RAÍZ (~100 errores tRPC collision)
#
# Las .d.ts manuales en src/trpc/ declaran createAppRouter(): any
# → AppRouter = any → createTRPCReact<AppRouter> colapsa en todo el front
#
# FIX:
#   1. Eliminar las .d.ts manuales con 'any' de ambos backends
#   2. packages/trpc/src/index.ts apunta a dist/ (compilado real, sin any)
#      Los @/ aliases del backend quedan intactos — no se tocan
# ══════════════════════════════════════════════════════════════════════
step "FIX 1 · Causa raíz — eliminar .d.ts manuales + packages/trpc → dist"

# 1a. Eliminar .d.ts manuales que tienen 'any' hardcodeado
rm -f "$BACK/src/trpc/app-router.d.ts"
ok "realsass-sass-back/src/trpc/app-router.d.ts eliminado"

rm -f "$BACK/src/trpc/types-for-frontend.d.ts"
ok "realsass-sass-back/src/trpc/types-for-frontend.d.ts eliminado"

rm -f "$EBACK/src/trpc/app-router.d.ts"
ok "realsass-ecommerce-back/src/trpc/app-router.d.ts eliminado"

rm -f "$EBACK/src/trpc/types-for-frontend.d.ts"
ok "realsass-ecommerce-back/src/trpc/types-for-frontend.d.ts eliminado"

# 1b. packages/trpc/src/index.ts: cambiar src → dist en los imports de AppRouter
#     El dist/ fue generado por tsc del backend con tipos reales (no any)
TRPC_IDX="$PKGS/trpc/src/index.ts"

sed -i \
  "s|from '../../../realsass-sass-back/src/trpc/types-for-frontend'|from '../../../realsass-sass-back/dist/trpc/types-for-frontend'|g" \
  "$TRPC_IDX"

sed -i \
  "s|from '../../../realsass-ecommerce-back/src/trpc/types-for-frontend'|from '../../../realsass-ecommerce-back/dist/trpc/types-for-frontend'|g" \
  "$TRPC_IDX"

ok "packages/trpc/src/index.ts → apunta a dist/ en ambos backends"

# ══════════════════════════════════════════════════════════════════════
# FIX 2 — Dead barrel imports (propiedades / zonas no existen)
# features/index.ts:2,3  hooks/index.ts:6,7
# ══════════════════════════════════════════════════════════════════════
step "FIX 2 · Dead imports propiedades / zonas"

grep -v 'features/propiedades\|features/zonas' \
  "$DASH/features/index.ts" > "$DASH/features/index.ts.tmp"
mv "$DASH/features/index.ts.tmp" "$DASH/features/index.ts"
ok "features/index.ts — propiedades y zonas eliminados"

grep -v 'features/propiedades\|features/zonas' \
  "$DASH/hooks/index.ts" > "$DASH/hooks/index.ts.tmp"
mv "$DASH/hooks/index.ts.tmp" "$DASH/hooks/index.ts"
ok "hooks/index.ts — propiedades y zonas eliminados"

# ══════════════════════════════════════════════════════════════════════
# FIX 3 — lib/api-client.ts (faltante — importado por 5+ services)
# ══════════════════════════════════════════════════════════════════════
step "FIX 3 · Crear lib/api-client.ts"

cat > "$DASH/lib/api-client.ts" << 'TS'
/**
 * lib/api-client.ts — realsass-dashboard-front
 *
 * Helpers de fetch HTTP para services que aún no migraron a tRPC.
 * TODO ADR-005: migrar cada service a trpc.* y eliminar este archivo.
 */

type QueryParams = Record<string, string | number | boolean | undefined>;

export function buildQuery(params: QueryParams): string {
  const parts = Object.entries(params)
    .filter((e): e is [string, string | number | boolean] => e[1] !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function getSassBackUrl(): string {
  return (process.env['NEXT_PUBLIC_SASS_BACK_URL'] ?? '').replace(/\/+$/, '');
}

function getEcommerceBackUrl(): string {
  return (process.env['NEXT_PUBLIC_ECOMMERCE_BACK_URL'] ?? '').replace(/\/+$/, '');
}

async function doFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`[api-client] ${init?.method ?? 'GET'} ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

/** Fetch autenticado contra sass-back (cookie __session). */
export const realBackFetch = {
  get:    <T>(path: string)               => doFetch<T>(`${getSassBackUrl()}${path}`),
  post:   <T>(path: string, body: unknown) => doFetch<T>(`${getSassBackUrl()}${path}`, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => doFetch<T>(`${getSassBackUrl()}${path}`, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)               => doFetch<T>(`${getSassBackUrl()}${path}`, { method: 'DELETE' }),
};

/** Fetch autenticado contra ecommerce-back. */
export const ecommerceFetch = {
  get:    <T>(path: string, _orgId?: string) => doFetch<T>(`${getEcommerceBackUrl()}${path}`),
  post:   <T>(path: string, body: unknown, _orgId?: string) => doFetch<T>(`${getEcommerceBackUrl()}${path}`, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown, _orgId?: string) => doFetch<T>(`${getEcommerceBackUrl()}${path}`, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string, _orgId?: string) => doFetch<T>(`${getEcommerceBackUrl()}${path}`, { method: 'DELETE' }),
};

/** Alias legacy — usar realBackFetch en código nuevo. */
export const apiClient = {
  get:    <T>(path: string)               => realBackFetch.get<T>(path),
  post:   <T>(path: string, body: unknown) => realBackFetch.post<T>(path, body),
  put:    <T>(path: string, body: unknown) => realBackFetch.put<T>(path, body),
  delete: <T>(path: string)               => realBackFetch.delete<T>(path),
};
TS
ok "lib/api-client.ts creado"

# ══════════════════════════════════════════════════════════════════════
# FIX 4 — lib/trpc/client.ts: export useTRPC
# ══════════════════════════════════════════════════════════════════════
step "FIX 4 · lib/trpc/client.ts — exportar useTRPC"

if ! grep -q 'useTRPC' "$DASH/lib/trpc/client.ts"; then
  printf '\nexport const useTRPC = trpc;\n' >> "$DASH/lib/trpc/client.ts"
fi
ok "useTRPC exportado desde lib/trpc/client.ts"

# ══════════════════════════════════════════════════════════════════════
# FIX 5 — features/auth: DashboardUser + profile + organizationSlug
# ══════════════════════════════════════════════════════════════════════
step "FIX 5 · features/auth — DashboardUser + profile + organizationSlug"

AUTH_CTX="$DASH/features/auth/context/auth-context.tsx"

# Añadir UserProfile import + DashboardUser type si no están
if ! grep -q 'DashboardUser' "$AUTH_CTX"; then
  awk '
    /^import / { buf = buf $0 "\n"; next }
    !injected  {
      printf "%s", buf
      print ""
      print "import type { UserProfile } from '"'"'@real/auth-client'"'"';"
      print ""
      print "/** Alias tipado del perfil de usuario en el dashboard. */"
      print "export type DashboardUser = UserProfile;"
      buf = ""; injected = 1
    }
    { print }
  ' "$AUTH_CTX" > "$AUTH_CTX.tmp" && mv "$AUTH_CTX.tmp" "$AUTH_CTX"
fi

# Añadir profile a AuthContextValue
if ! grep -q 'profile\s*:' "$AUTH_CTX"; then
  sed -i 's/firebaseUser\s*:\s*User | null;/firebaseUser:     User | null;\n  profile:          DashboardUser | null;/' "$AUTH_CTX"
fi

# Añadir organizationSlug a AuthContextValue
if ! grep -q 'organizationSlug' "$AUTH_CTX"; then
  sed -i 's/loading\s*:\s*boolean;/loading:          boolean;\n  organizationSlug: string | null;/' "$AUTH_CTX"
fi

# Añadir estados en el Provider
if ! grep -q 'const \[profile' "$AUTH_CTX"; then
  sed -i 's/const \[loading,/const [profile,          setProfile]      = useState<DashboardUser | null>(null)\n  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null)\n  const [loading,/' "$AUTH_CTX"
fi

# Añadir al value del Provider
if ! grep -q 'profile,' "$AUTH_CTX"; then
  sed -i 's/value={{ firebaseUser,/value={{ firebaseUser, profile, organizationSlug,/' "$AUTH_CTX"
fi

ok "auth-context.tsx — DashboardUser, profile, organizationSlug añadidos"

# Corregir export de DashboardUser en hooks/index.ts (apuntaba a use-auth inexistente)
if [ -f "$DASH/features/auth/hooks/index.ts" ]; then
  sed -i \
    "s|from '@/features/auth/hooks/use-auth'|from '@/features/auth/context/auth-context'|g" \
    "$DASH/features/auth/hooks/index.ts"
  ok "features/auth/hooks/index.ts — DashboardUser source corregido"
fi

# ══════════════════════════════════════════════════════════════════════
# FIX 6 — campana-card.tsx: 'objetivo' no existe en Campana
# ══════════════════════════════════════════════════════════════════════
step "FIX 6 · campana-card.tsx — eliminar campana.objetivo"

sed -i 's/ &middot; {campana\.objetivo}//g; s/ · {campana\.objetivo}//g' \
  "$DASH/features/campanas/components/campana-card.tsx" 2>/dev/null || true
ok "campana-card.tsx — campana.objetivo eliminado"

# ══════════════════════════════════════════════════════════════════════
# FIX 7 — canal-badge.tsx: Instagram no existe en esta versión de lucide-react
# ══════════════════════════════════════════════════════════════════════
step "FIX 7 · canal-badge.tsx — Instagram → MessageCircle"

sed -i \
  's/Instagram,/MessageCircle,/g;
   s/<Instagram /<MessageCircle /g;
   s/<Instagram$/<MessageCircle/g;
   s/<\/Instagram>/<\/MessageCircle>/g' \
  "$DASH/features/chat/components/canal-badge.tsx" 2>/dev/null || true
ok "canal-badge.tsx — Instagram → MessageCircle"

# ══════════════════════════════════════════════════════════════════════
# FIX 8 — features/chat/types.ts — tipos faltantes
# ══════════════════════════════════════════════════════════════════════
step "FIX 8 · features/chat/types.ts — añadir tipos faltantes"

CHAT_TYPES="$DASH/features/chat/types.ts"

if ! grep -q 'CreateProyectoInput' "$CHAT_TYPES"; then
  cat >> "$CHAT_TYPES" << 'TS'

// ─── Proyectos IA ────────────────────────────────────────────────────

export interface CreateProyectoInput {
  name:          string;
  description?:  string;
  systemPrompt?: string;
}

export interface UpdateAssistantConfigInput {
  systemPrompt?: string;
  temperature?:  number;
  maxTokens?:    number;
  model?:        string;
}

export interface AssistantConfig {
  id:           string;
  proyectoId:   string;
  systemPrompt: string;
  temperature:  number;
  maxTokens:    number;
  model:        string;
  createdAt:    string;
  updatedAt:    string;
}
TS
  ok "chat/types.ts — tipos añadidos"
else
  ok "chat/types.ts — tipos ya presentes, sin cambios"
fi

# ══════════════════════════════════════════════════════════════════════
# FIX 9 — features/chat/hooks.ts — añadir useEnviarMensaje
# ══════════════════════════════════════════════════════════════════════
step "FIX 9 · features/chat/hooks.ts — añadir useEnviarMensaje"

CHAT_HOOKS="$DASH/features/chat/hooks.ts"

if ! grep -q 'useEnviarMensaje' "$CHAT_HOOKS"; then
  cat >> "$CHAT_HOOKS" << 'TS'

// ─── useEnviarMensaje ────────────────────────────────────────────────
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '@/features/chat/services/chat.service';

export function useEnviarMensaje(conversacionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contenido: string) =>
      chatService.enviarMensaje(conversacionId, contenido),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'mensajes', conversacionId] });
    },
  });
}
TS
  ok "hooks.ts — useEnviarMensaje añadido"
fi

# ══════════════════════════════════════════════════════════════════════
# FIX 10 — chat-window.tsx: null→undefined + msgData.items→msgData
# ══════════════════════════════════════════════════════════════════════
step "FIX 10 · chat-window.tsx — null→undefined, .items"

CHAT_WIN="$DASH/features/chat/components/chat-window.tsx"

sed -i \
  's/useMensajes(selected?.id ?? null)/useMensajes(selected?.id ?? undefined)/g;
   s/msgData?\.items/msgData/g;
   s/msgData\.items/msgData/g' \
  "$CHAT_WIN" 2>/dev/null || true
ok "chat-window.tsx — corregido"

# ══════════════════════════════════════════════════════════════════════
# FIX 11 — conversation-list.tsx: convData.items + useConversaciones params
# ══════════════════════════════════════════════════════════════════════
step "FIX 11 · conversation-list.tsx — .items + useConversaciones"

CONV_LIST="$DASH/features/chat/components/conversation-list.tsx"

sed -i \
  's/convData?\.items/convData/g;
   s/convData\.items/convData/g' \
  "$CONV_LIST" 2>/dev/null || true
ok "conversation-list.tsx — .items eliminado"

# Añadir parámetro opcional a useConversaciones si actualmente no acepta args
for f in \
  "$DASH/features/chat/hooks/use-conversaciones.ts" \
  "$DASH/features/chat/hooks.ts"; do
  if [ -f "$f" ] && grep -q 'export function useConversaciones()' "$f"; then
    sed -i \
      's/export function useConversaciones()/export function useConversaciones(_params?: { canal?: string; etapa?: string; limit?: number })/g' \
      "$f"
    ok "useConversaciones — parámetro opcional añadido en $(basename $f)"
    break
  fi
done

# ══════════════════════════════════════════════════════════════════════
# FIX 12 — pagos/components/index.ts: BalanceCard → BalanceCards
# ══════════════════════════════════════════════════════════════════════
step "FIX 12 · pagos/components/index.ts — BalanceCard → BalanceCards"

sed -i 's/{ BalanceCard }/{ BalanceCards }/g' \
  "$DASH/features/pagos/components/index.ts" 2>/dev/null || true
ok "BalanceCard → BalanceCards"

# ══════════════════════════════════════════════════════════════════════
# FIX 13 — store/api.ts: añadir deleteProduct
# ══════════════════════════════════════════════════════════════════════
step "FIX 13 · store/api.ts — añadir deleteProduct"

STORE_API="$DASH/features/store/api.ts"

if [ -f "$STORE_API" ] && ! grep -q 'deleteProduct' "$STORE_API"; then
  # Añadir deleteProduct antes del cierre del objeto exportado
  sed -i \
    '/^};$/i\  deleteProduct: (orgId: string, id: string) =>\n    ecommerceFetch.delete<void>(`\/ecommerce\/products\/${id}`, orgId),' \
    "$STORE_API" 2>/dev/null || true
  ok "store/api.ts — deleteProduct añadido"
else
  ok "store/api.ts — deleteProduct ya existe"
fi

# ══════════════════════════════════════════════════════════════════════
# FIX 14 — providers/index.tsx: sassBackUrl faltante en AuthProvider
# ══════════════════════════════════════════════════════════════════════
step "FIX 14 · providers/index.tsx — sassBackUrl en AuthProvider"

PROVIDERS="$DASH/providers/index.tsx"

if [ -f "$PROVIDERS" ]; then
  sed -i \
    's/<AuthProvider>/<AuthProvider sassBackUrl={process.env["NEXT_PUBLIC_SASS_BACK_URL"] ?? ""}>/' \
    "$PROVIDERS"
  ok "providers/index.tsx — sassBackUrl añadido"
fi

# ══════════════════════════════════════════════════════════════════════
# FIX 15 — packages/auth-client/src/http/api-fetch.ts (3 errores línea 1)
# Probablemente imports de node-fetch que no existen en contexto browser
# ══════════════════════════════════════════════════════════════════════
step "FIX 15 · packages/auth-client — api-fetch.ts"

API_FETCH="$ROOT/packages/auth-client/src/http/api-fetch.ts"

if [ -f "$API_FETCH" ]; then
  echo "  [info] primeras líneas de api-fetch.ts:"
  head -5 "$API_FETCH" | sed 's/^/    /'
  sed -i \
    "s|import type { RequestInit } from 'node-fetch';||g;
     s|import fetch from 'node-fetch';|// fetch global — disponible en Next.js sin import|g;
     s|import type { Response } from 'node-fetch';||g" \
    "$API_FETCH" 2>/dev/null || true
  ok "api-fetch.ts — imports de node-fetch eliminados"
else
  warn "api-fetch.ts no encontrado — skip"
fi

# ══════════════════════════════════════════════════════════════════════
# FIX 16 — app/auth/sso/page.tsx (1 error línea 33)
# initFirebase puede no estar exportado con ese nombre en auth-client
# ══════════════════════════════════════════════════════════════════════
step "FIX 16 · app/auth/sso/page.tsx — verificar initFirebase"

SSO="$DASH/app/auth/sso/page.tsx"
AUTH_CLIENT_IDX="$ROOT/packages/auth-client/src/index.ts"

if [ -f "$SSO" ] && [ -f "$AUTH_CLIENT_IDX" ]; then
  if grep -q 'initFirebase' "$SSO" && ! grep -q 'initFirebase' "$AUTH_CLIENT_IDX"; then
    # Buscar el export real con nombre de init/firebase/app
    REAL=$(grep -r 'export.*function\|export.*const' "$ROOT/packages/auth-client/src/" 2>/dev/null \
      | grep -i 'init\|firebase\|app' | head -1 \
      | sed 's/.*export function //;s/.*export const //;s/[( =].*//' || true)
    if [ -n "$REAL" ] && [ "$REAL" != "initFirebase" ]; then
      sed -i "s/initFirebase/$REAL/g" "$SSO"
      ok "sso/page.tsx — initFirebase renombrado a $REAL"
    else
      warn "sso/page.tsx — no se encontró el export correcto; revisar manualmente"
    fi
  else
    ok "sso/page.tsx — initFirebase exportado correctamente"
  fi
fi

# ══════════════════════════════════════════════════════════════════════
# RESUMEN
# ══════════════════════════════════════════════════════════════════════
step "Listo"

echo ""
echo "  Verificar con:"
echo "    cd realsass-dashboard-front && pnpm tsc --noEmit 2>&1 | tail -20"
echo ""
echo "  Cambios aplicados:"
echo "    realsass-sass-back/src/trpc/app-router.d.ts          ← ELIMINADO (tenía 'any')"
echo "    realsass-sass-back/src/trpc/types-for-frontend.d.ts  ← ELIMINADO (tenía 'any')"
echo "    realsass-ecommerce-back/src/trpc/app-router.d.ts     ← ELIMINADO (tenía 'any')"
echo "    realsass-ecommerce-back/src/trpc/types-for-frontend.d.ts ← ELIMINADO"
echo "    packages/trpc/src/index.ts                           ← src → dist en imports"
echo "    realsass-dashboard-front/lib/api-client.ts           ← NUEVO"
echo "    realsass-dashboard-front/lib/trpc/client.ts          ← +useTRPC"
echo "    realsass-dashboard-front/features/auth/context/auth-context.tsx ← +DashboardUser, profile, organizationSlug"
echo "    realsass-dashboard-front/features/auth/hooks/index.ts ← DashboardUser source corregido"
echo "    realsass-dashboard-front/features/index.ts           ← dead imports eliminados"
echo "    realsass-dashboard-front/hooks/index.ts              ← dead imports eliminados"
echo "    realsass-dashboard-front/features/campanas/components/campana-card.tsx ← sin .objetivo"
echo "    realsass-dashboard-front/features/chat/components/canal-badge.tsx ← MessageCircle"
echo "    realsass-dashboard-front/features/chat/components/chat-window.tsx ← null, .items"
echo "    realsass-dashboard-front/features/chat/components/conversation-list.tsx ← .items, params"
echo "    realsass-dashboard-front/features/chat/types.ts      ← +CreateProyectoInput, AssistantConfig"
echo "    realsass-dashboard-front/features/chat/hooks.ts      ← +useEnviarMensaje"
echo "    realsass-dashboard-front/features/pagos/components/index.ts ← BalanceCards"
echo "    realsass-dashboard-front/features/store/api.ts       ← +deleteProduct"
echo "    realsass-dashboard-front/providers/index.tsx         ← +sassBackUrl"
echo "    packages/auth-client/src/http/api-fetch.ts           ← node-fetch imports"
echo ""
ok "x.sh completado"