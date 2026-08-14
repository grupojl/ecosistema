#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix auth-context: force refresh de token después de syncUser
#
# Repos afectados:
#   realsass-sass-front      → context/auth-context.tsx
#   realsass-dashboard-front → features/auth/context/auth-context.tsx
#
# Problema:
#   syncUser() emite custom claims (permissions.chat) en Firebase,
#   pero el token en memoria NO se actualiza hasta el refresh natural (55 min).
#   Chat-ia-back rechaza con 403 porque no encuentra permissions.chat.
#
# Solución:
#   Después de await syncUser(...), insertar await user.getIdToken(true)
#   para forzar un token fresco con los claims recién escritos por ClaimsService.
#
# USO (desde raíz del monorepo welver/):
#   bash x.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
err()     { echo -e "${RED}[✗]${NC} $1"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ -d "$ROOT/realsass-sass-front" ]]      || err "Ejecutá desde la raíz del monorepo welver/"
[[ -d "$ROOT/realsass-dashboard-front" ]] || err "No encontré realsass-dashboard-front."

# =============================================================================
# patch_file FILE LABEL
#   Busca la línea con "await syncUser(" y agrega el getIdToken(true) debajo.
#   Usa node --eval para el reemplazo — disponible en cualquier entorno con Node.
# =============================================================================
patch_file() {
  local FILE="$1"
  local LABEL="$2"

  [[ -f "$FILE" ]] || { warn "No encontré $FILE — saltando"; return; }

  # Ya parcheado
  if grep -q 'forceRefresh.*true\|force.*refresh.*claims\|ADR-003' "$FILE"; then
    warn "$LABEL ya tiene el fix — sin cambios"
    return
  fi

  # Verificar que existe el patrón antes de tocar el archivo
  if ! grep -q 'await syncUser(' "$FILE"; then
    warn "$LABEL no contiene 'await syncUser(' — revisá manualmente"
    return
  fi

  cp "$FILE" "$FILE.bak"
  echo "[→] backup → $(basename "$FILE").bak"

  # Node.js lee el archivo, hace el reemplazo y lo escribe de vuelta.
  # Busca la línea exacta con "await syncUser(" y le agrega las 4 líneas debajo.
  node --eval "
const fs   = require('fs');
const path = '$FILE';
const src  = fs.readFileSync(path, 'utf8');

const SEARCH = 'await syncUser(';
const INSERT  = [
  '',
  '        // ADR-003: forzar refresh inmediato del token para que incluya',
  '        // permissions.chat emitidos por ClaimsService en sass-back.',
  '        // Sin esto chat-ia-back rechaza con 403 hasta el refresh natural (55 min).',
  '        await user.getIdToken(/* forceRefresh */ true)',
].join('\n');

// Reemplazar solo la primera ocurrencia de la línea que contiene await syncUser(
const lines  = src.split('\n');
let patched  = false;
const result = [];

for (const line of lines) {
  result.push(line);
  if (!patched && line.includes(SEARCH)) {
    result.push(INSERT);
    patched = true;
  }
}

if (!patched) {
  console.error('WARN: patron no encontrado');
  process.exit(1);
}

fs.writeFileSync(path, result.join('\n'), 'utf8');
console.log('OK: reemplazo aplicado en ' + path);
"

  ok "$LABEL parcheado"
}

# =============================================================================
section "realsass-sass-front — context/auth-context.tsx"
# =============================================================================

patch_file \
  "$ROOT/realsass-sass-front/context/auth-context.tsx" \
  "sass-front/context/auth-context.tsx"

# =============================================================================
section "realsass-dashboard-front — auth-context.tsx"
# =============================================================================

DASH_CTX=""
for candidate in \
  "$ROOT/realsass-dashboard-front/features/auth/context/auth-context.tsx" \
  "$ROOT/realsass-dashboard-front/context/auth-context.tsx" \
  "$ROOT/realsass-dashboard-front/app/context/auth-context.tsx"
do
  [[ -f "$candidate" ]] && { DASH_CTX="$candidate"; break; }
done

# Fallback búsqueda recursiva
if [[ -z "$DASH_CTX" ]]; then
  DASH_CTX=$(find "$ROOT/realsass-dashboard-front" -name "auth-context.tsx" 2>/dev/null | head -1 || true)
fi

if [[ -z "$DASH_CTX" ]]; then
  warn "No encontré auth-context.tsx en dashboard-front"
  echo "  Agregá manualmente después de 'await syncUser(...)':"
  echo "    await user.getIdToken(/* forceRefresh */ true)"
else
  echo "[→] Encontrado: $DASH_CTX"
  patch_file "$DASH_CTX" "dashboard-front auth-context.tsx"
fi

# =============================================================================
section "Resumen"
# =============================================================================

echo ""
echo "  Cambios aplicados:"
echo "    ~ realsass-sass-front/context/auth-context.tsx"
echo "    ~ realsass-dashboard-front/.../auth-context.tsx"
echo ""
echo "  Flujo resultante:"
echo "    Login → syncUser() → claims emitidos por sass-back"
echo "          → getIdToken(true) → token fresco con permissions.chat"
echo "          → chat-ia-back acepta directo desde el front"
echo ""
echo "  Próximos pasos:"
echo "    git add ."
echo "    git commit -m 'fix: force token refresh post-sync para claims de chat (ADR-003)'"
echo "    git push origin main"
echo ""
echo "  Verificación post-deploy:"
echo "    1. Logout completo en el browser → login de nuevo"
echo "    2. Network tab → POST /auth/sync → copiar Bearer token"
echo "    3. curl https://chatia-backend-production.up.railway.app/api/v1/projects \\"
echo "         -H 'Authorization: Bearer TOKEN' \\"
echo "         -H 'x-organization-id: f8a5c145-6058-4fcd-8c42-30f9b4e0c792'"
echo "    4. Esperado: [] o lista de proyectos — NO 403"
echo ""