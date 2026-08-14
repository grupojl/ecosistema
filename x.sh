#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix dashboard-front: chat desbloqueado + NEXT_PUBLIC_CHAT_IA_URL
#
# Problema 1: sidebar bloquea chat porque navigation.ts verifica
#   enabledProducts.chat — pero el campo en el perfil viene como boolean
#   directo y el sidebar espera algo diferente.
#
# Problema 2: chatIaFetch llama a /api/v1/projects sin el base URL
#   porque NEXT_PUBLIC_CHAT_IA_URL está vacía en Railway.
#
# Fix 1: en config/navigation.ts — hacer que chat siempre esté enabled
#         mientras enabledProducts.chat sea true (ya lo configuramos en DB)
# Fix 2: agregar guard en chat-ia-client.ts que avise si la URL no está
#
# USO (desde raíz del monorepo welver/):
#   bash x.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

DASH="$(pwd)/realsass-dashboard-front"
[[ -d "$DASH" ]] || { echo "No encontré realsass-dashboard-front en $(pwd)"; exit 1; }

# =============================================================================
section "Fix 1 — config/navigation.ts: habilitar chat"
# =============================================================================

NAV="$DASH/config/navigation.ts"

if [[ ! -f "$NAV" ]]; then
  warn "No encontré config/navigation.ts — creando desde cero"
  mkdir -p "$DASH/config"
  cat > "$NAV" << 'EOF'
// config/navigation.ts
import {
  Package, ShoppingBag, MessageSquare,
  CreditCard, TrendingUp, Palette,
  ToggleLeft, Webhook, BarChart2,
} from 'lucide-react';

export interface NavItem {
  label:       string;
  href:        string;
  icon:        React.ElementType;
  productKey?: string;   // si está definido, se verifica enabledProducts[productKey]
  locked?:     boolean;  // fuerza bloqueo independiente del producto
  children?:   NavItem[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Tienda',
    items: [
      { label: 'Productos',    href: '/dashboard/tienda/productos', icon: Package,      productKey: 'ecommerce' },
      { label: 'Pedidos',      href: '/dashboard/tienda/pedidos',   icon: ShoppingBag,  productKey: 'ecommerce' },
    ],
  },
  {
    title: 'Chat IA',
    items: [
      { label: 'Conversaciones', href: '/dashboard/chat',            icon: MessageSquare, productKey: 'chat' },
      { label: 'Proyectos IA',   href: '/dashboard/chat/proyectos',  icon: BarChart2,     productKey: 'chat' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { label: 'Tema',      href: '/dashboard/configuracion/tema',     icon: Palette    },
      { label: 'Flags',     href: '/dashboard/configuracion/flags',    icon: ToggleLeft },
      { label: 'Webhooks',  href: '/dashboard/configuracion/webhooks', icon: Webhook    },
    ],
  },
];
EOF
  ok "navigation.ts creado"
else
  # Ya existe — verificar si tiene productKey para chat y si está bloqueado
  if grep -q "locked.*true\|enabled.*false\|productKey.*chat" "$NAV"; then
    echo "[→] navigation.ts tiene referencia a chat — actualizando"
    # Quitar locked: true de los items de chat
    node --eval "
const fs  = require('fs');
const src = fs.readFileSync('$NAV', 'utf8');
// Quitar locked: true de items que tienen href con 'chat'
const result = src.replace(/(\{[^}]*href:\s*['\"]\/?dashboard\/chat[^}]*),\s*locked:\s*true/g, '\$1');
fs.writeFileSync('$NAV', result, 'utf8');
console.log('OK: locked:true removido de items de chat');
"
  else
    warn "navigation.ts no tiene locked:true en chat — puede ser otro mecanismo"
  fi
fi

# =============================================================================
section "Fix 2 — dashboard-sidebar.tsx: verificar productKey contra perfil"
# =============================================================================

SIDEBAR="$DASH/components/layout/dashboard-sidebar.tsx"

if grep -q 'productKey\|enabledProducts' "$SIDEBAR" 2>/dev/null; then
  echo "[→] sidebar ya verifica productKey — revisando lógica"
  # Asegurar que enabledProducts.chat === true habilita el item
  node --eval "
const fs  = require('fs');
const src = fs.readFileSync('$SIDEBAR', 'utf8');
// Si hay una condición que deshabilita con enabledProducts[key] !== true
// la reemplazamos para que sea permisiva (undefined = habilitado)
const result = src.replace(
  /enabledProducts\[item\.productKey\]\s*!==\s*true/g,
  'enabledProducts[item.productKey] === false'
);
if (result !== src) {
  fs.writeFileSync('$SIDEBAR', result, 'utf8');
  console.log('OK: condición de bloqueo actualizada — undefined = habilitado');
} else {
  console.log('INFO: condición no encontrada — sin cambios en sidebar');
}
"
else
  warn "sidebar no verifica enabledProducts directamente — el bloqueo puede estar en navigation.ts"
fi

# =============================================================================
section "Fix 3 — chat-ia-client.ts: guard si NEXT_PUBLIC_CHAT_IA_URL está vacía"
# =============================================================================

CLIENT="$DASH/lib/chat-ia-client.ts"
[[ -f "$CLIENT" ]] || { warn "No encontré chat-ia-client.ts"; exit 1; }

if grep -q 'CHAT_IA_URL.*\|\|.*console\|throw.*NEXT_PUBLIC' "$CLIENT" 2>/dev/null; then
  warn "chat-ia-client.ts ya tiene guard — sin cambios"
else
  node --eval "
const fs  = require('fs');
const src = fs.readFileSync('$CLIENT', 'utf8');
const result = src.replace(
  \"const CHAT_IA_URL = process.env['NEXT_PUBLIC_CHAT_IA_URL'] ?? '';\",
  \`const CHAT_IA_URL = process.env['NEXT_PUBLIC_CHAT_IA_URL'] ?? '';
if (!CHAT_IA_URL && typeof window !== 'undefined') {
  console.warn('[chat-ia] NEXT_PUBLIC_CHAT_IA_URL no está configurada. Los requests a chat-ia-back fallarán.');
}\`
);
fs.writeFileSync('$CLIENT', result, 'utf8');
console.log('OK: guard agregado en chat-ia-client.ts');
"
  ok "chat-ia-client.ts actualizado"
fi

# =============================================================================
section "Resumen y acciones pendientes"
# =============================================================================
echo ""
echo "  Cambios en código:"
echo "    ~ realsass-dashboard-front/config/navigation.ts"
echo "    ~ realsass-dashboard-front/components/layout/dashboard-sidebar.tsx"
echo "    ~ realsass-dashboard-front/lib/chat-ia-client.ts"
echo ""
echo "  ── ACCIÓN REQUERIDA EN RAILWAY ──────────────────────────────────────"
echo "  Railway → realsass-dashboard-front → Variables → Agregar:"
echo ""
echo "    NEXT_PUBLIC_CHAT_IA_URL=https://chatia-backend-production.up.railway.app"
echo ""
echo "  Sin esta variable el fetch va al mismo dominio del front (404)."
echo "  ─────────────────────────────────────────────────────────────────────"
echo ""
echo "  Próximos pasos:"
echo "    1. Configurar NEXT_PUBLIC_CHAT_IA_URL en Railway (si no está)"
echo "    2. git add ."
echo "    3. git commit -m 'fix: chat desbloqueado en sidebar + guard URL chat-ia'"
echo "    4. git push origin main"
echo "    5. Navegar a /dashboard/chat/proyectos"
echo ""