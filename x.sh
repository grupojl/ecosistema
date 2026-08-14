#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix definitivo: import ProfileForClaims en auth.service.ts
#
# El problema: ProfileForClaims ya está exportada en claims.service.ts
# pero auth.service.ts no la importa. El script anterior fallaba porque
# el regex no matcheaba el formato exacto del import.
#
# Solución: agregar el import con type en la primera línea del archivo,
# independientemente del formato del import existente de ClaimsService.
#
# USO (desde raíz del monorepo welver/):
#   bash x.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
err()     { echo -e "${RED}[✗]${NC} $1"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -d "$ROOT/realsass-sass-back" ]] || err "Ejecutá desde la raíz del monorepo welver/"

# =============================================================================
section "Fix — auth.service.ts: import ProfileForClaims"
# =============================================================================

AUTH_SVC="$ROOT/realsass-sass-back/src/auth/auth.service.ts"
[[ -f "$AUTH_SVC" ]] || err "No encontré $AUTH_SVC"

# Verificar estado actual
echo "[→] Revisando auth.service.ts..."
grep -n 'ProfileForClaims\|ClaimsService\|claims.service' "$AUTH_SVC" || true

if grep -q "import.*ProfileForClaims.*claims\.service\|import type.*ProfileForClaims" "$AUTH_SVC"; then
  warn "ProfileForClaims ya está importada correctamente"
else
  cp "$AUTH_SVC" "$AUTH_SVC.bak"
  echo "[→] backup creado"

  node --eval "
const fs  = require('fs');
const src = fs.readFileSync('$AUTH_SVC', 'utf8');

// Verificar que ProfileForClaims no está ya importada
if (src.includes('ProfileForClaims') && src.includes(\"import\") && src.includes(\"claims.service\") && src.match(/import.*ProfileForClaims.*claims/)) {
  console.log('Ya importada — sin cambios');
  process.exit(0);
}

// Agregar import al comienzo del archivo (antes de cualquier otra cosa)
// Usamos import type para que no genere runtime code
const IMPORT_LINE = \"import type { ProfileForClaims } from './claims.service';\";

// Insertar después de la primera línea de comentario o al inicio
const lines = src.split('\n');
let insertAt = 0;

// Buscar el final del bloque de comentarios iniciales
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('import ') || lines[i].startsWith('import{')) {
    insertAt = i;
    break;
  }
}

lines.splice(insertAt, 0, IMPORT_LINE);
const result = lines.join('\n');

fs.writeFileSync('$AUTH_SVC', result, 'utf8');
console.log('OK: import agregado en línea ' + insertAt);
"
  ok "import ProfileForClaims agregado"
fi

# Verificar resultado
echo ""
echo "[→] Verificando imports en auth.service.ts:"
grep -n 'import.*claims\|ProfileForClaims' "$AUTH_SVC"

# =============================================================================
section "Verificar claims.service.ts — ProfileForClaims exportada"
# =============================================================================

CLAIMS="$ROOT/realsass-sass-back/src/auth/claims.service.ts"
[[ -f "$CLAIMS" ]] || err "No encontré $CLAIMS"

if grep -q 'export interface ProfileForClaims' "$CLAIMS"; then
  ok "ProfileForClaims ya está exportada en claims.service.ts"
else
  cp "$CLAIMS" "$CLAIMS.bak"
  node --eval "
const fs  = require('fs');
const src = fs.readFileSync('$CLAIMS', 'utf8');
const result = src.replace(
  /^(interface ProfileForClaims)/m,
  'export interface ProfileForClaims'
);
if (result === src) {
  console.error('ERROR: no encontré interface ProfileForClaims — verificá manualmente');
  process.exit(1);
}
fs.writeFileSync('$CLAIMS', result, 'utf8');
console.log('OK: ProfileForClaims exportada');
"
  ok "claims.service.ts actualizado"
fi

echo ""
echo "[→] Verificando export en claims.service.ts:"
grep -n 'ProfileForClaims' "$CLAIMS"

# =============================================================================
section "Fix auth-context.tsx — getIdToken(true) post-syncUser"
# =============================================================================

patch_auth_context() {
  local FILE="$1"
  local LABEL="$2"

  [[ -f "$FILE" ]] || { warn "No encontré $FILE — saltando"; return; }

  if grep -q 'ADR-003\|forceRefresh.*true' "$FILE"; then
    warn "$LABEL ya tiene el fix — sin cambios"
    return
  fi

  if ! grep -q 'await syncUser(' "$FILE"; then
    warn "$LABEL: 'await syncUser(' no encontrado — saltando"
    return
  fi

  cp "$FILE" "$FILE.bak"

  node --eval "
const fs    = require('fs');
const lines = fs.readFileSync('$FILE', 'utf8').split('\n');
const INSERT = [
  '        // ADR-003: token refresh para claims de chat',
  '        await user.getIdToken(/* forceRefresh */ true)',
];
let patched = false;
const out = [];
for (const line of lines) {
  out.push(line);
  if (!patched && line.includes('await syncUser(')) {
    INSERT.forEach(l => out.push(l));
    patched = true;
  }
}
if (!patched) { console.log('WARN: patron no encontrado'); process.exit(0); }
fs.writeFileSync('$FILE', out.join('\n'), 'utf8');
console.log('OK: fix aplicado en $FILE');
"
  ok "$LABEL parcheado"
}

# sass-front
patch_auth_context \
  "$ROOT/realsass-sass-front/context/auth-context.tsx" \
  "sass-front"

# dashboard-front
DASH_CTX=$(find "$ROOT/realsass-dashboard-front" -name "auth-context.tsx" 2>/dev/null | head -1 || true)
[[ -n "$DASH_CTX" ]] && patch_auth_context "$DASH_CTX" "dashboard-front" || \
  warn "dashboard-front: auth-context no encontrado"

# ecommerce-front
ECO_CTX=$(find "$ROOT/real-ecommerce-front" -name "auth-context.tsx" 2>/dev/null | head -1 || true)
[[ -n "$ECO_CTX" ]] && patch_auth_context "$ECO_CTX" "ecommerce-front" || \
  warn "ecommerce-front: sin auth-context (storefront público — esperado)"

# =============================================================================
section "Resumen"
# =============================================================================
echo ""
echo "  Archivos modificados:"
echo "    ~ realsass-sass-back/src/auth/claims.service.ts  (export ProfileForClaims)"
echo "    ~ realsass-sass-back/src/auth/auth.service.ts    (import type ProfileForClaims)"
echo "    ~ realsass-sass-front/context/auth-context.tsx"
echo "    ~ realsass-dashboard-front/.../auth-context.tsx"
echo ""
echo "  Próximos pasos:"
echo "    git add ."
echo "    git commit -m 'fix: import ProfileForClaims + token refresh post-sync (ADR-003)'"
echo "    git push origin main"
echo ""