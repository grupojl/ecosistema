#!/usr/bin/env bash
# =============================================================================
# x.sh — Dos fixes + ecommerce-front
#
# Fix 1 — realsass-sass-back/src/auth/auth.service.ts
#   TS2345: organization:unknown no asignable a Record<string,unknown>
#   Solución: castear profile a ProfileForClaims antes de pasarlo
#
# Fix 2 — auth-context.tsx en los 3 fronts
#   Agregar getIdToken(true) post-syncUser para claims frescos de chat
#   Afecta: sass-front, dashboard-front, ecommerce-front
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
[[ -d "$ROOT/realsass-sass-back" ]] || err "Ejecutá desde la raíz del monorepo welver/"

# =============================================================================
section "Fix 1 — realsass-sass-back/src/auth/auth.service.ts"
# Problema: TypeScript strict rechaza organization:unknown como Record<string,unknown>
# Solución: castear el profile a ProfileForClaims en los 3 call sites
# =============================================================================

AUTH_SVC="$ROOT/realsass-sass-back/src/auth/auth.service.ts"
[[ -f "$AUTH_SVC" ]] || err "No encontré $AUTH_SVC"

if grep -q 'as ProfileForClaims\|profileForClaims' "$AUTH_SVC"; then
  warn "auth.service.ts ya tiene el cast — sin cambios"
else
  cp "$AUTH_SVC" "$AUTH_SVC.bak"
  echo "[→] backup → auth.service.ts.bak"

  # Reemplazar las 3 ocurrencias de buildClaimsFromProfile(profile)
  # con buildClaimsFromProfile(profile as ProfileForClaims)
  node --eval "
const fs  = require('fs');
const src = fs.readFileSync('$AUTH_SVC', 'utf8');

// Aseguramos que ProfileForClaims esté importado desde claims.service
// (ya debería estarlo, pero lo verificamos)
let result = src;

// Reemplazar todas las ocurrencias del call site con el cast
result = result.replaceAll(
  'this.claims.buildClaimsFromProfile(profile)',
  'this.claims.buildClaimsFromProfile(profile as unknown as ProfileForClaims)'
);

// Verificar que ProfileForClaims está importado
if (!result.includes('ProfileForClaims')) {
  // Agregar import junto al de ClaimsService
  result = result.replace(
    \"import { ClaimsService } from './claims.service';\",
    \"import { ClaimsService, ProfileForClaims } from './claims.service';\"
  );
}

const count = (src.match(/buildClaimsFromProfile\(profile\)/g) || []).length;
fs.writeFileSync('$AUTH_SVC', result, 'utf8');
console.log('OK: ' + count + ' ocurrencias reemplazadas');
"

  ok "auth.service.ts corregido"
fi

# =============================================================================
# patch_auth_context FILE LABEL
# Agrega getIdToken(true) después de await syncUser(...) usando Node.js
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
    warn "$LABEL no contiene 'await syncUser(' — revisá manualmente"
    return
  fi

  cp "$FILE" "$FILE.bak"
  echo "[→] backup → $(basename "$FILE").bak"

  node --eval "
const fs    = require('fs');
const path  = '$FILE';
const lines = fs.readFileSync(path, 'utf8').split('\n');
const INSERT = [
  '        // ADR-003: forzar refresh inmediato del token para que incluya',
  '        // permissions.chat emitidos por ClaimsService en sass-back.',
  '        // Sin esto chat-ia-back rechaza con 403 hasta el refresh natural (55 min).',
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
if (!patched) { console.error('WARN: patron no encontrado'); process.exit(0); }
fs.writeFileSync(path, out.join('\n'), 'utf8');
console.log('OK: fix aplicado en ' + path);
"

  ok "$LABEL parcheado"
}

# =============================================================================
section "Fix 2 — auth-context.tsx en los 3 fronts"
# =============================================================================

# ── sass-front ────────────────────────────────────────────────────────────────
patch_auth_context \
  "$ROOT/realsass-sass-front/context/auth-context.tsx" \
  "sass-front/context/auth-context.tsx"

# ── dashboard-front ───────────────────────────────────────────────────────────
DASH_CTX=""
for c in \
  "$ROOT/realsass-dashboard-front/features/auth/context/auth-context.tsx" \
  "$ROOT/realsass-dashboard-front/context/auth-context.tsx" \
  "$ROOT/realsass-dashboard-front/app/context/auth-context.tsx"
do
  [[ -f "$c" ]] && { DASH_CTX="$c"; break; }
done
[[ -z "$DASH_CTX" ]] && \
  DASH_CTX=$(find "$ROOT/realsass-dashboard-front" -name "auth-context.tsx" 2>/dev/null | head -1 || true)

if [[ -z "$DASH_CTX" ]]; then
  warn "No encontré auth-context.tsx en dashboard-front — aplicá el fix manualmente"
else
  patch_auth_context "$DASH_CTX" "dashboard-front auth-context.tsx"
fi

# ── ecommerce-front ───────────────────────────────────────────────────────────
ECO_CTX=""
for c in \
  "$ROOT/real-ecommerce-front/context/auth-context.tsx" \
  "$ROOT/real-ecommerce-front/features/auth/context/auth-context.tsx" \
  "$ROOT/real-ecommerce-front/app/context/auth-context.tsx"
do
  [[ -f "$c" ]] && { ECO_CTX="$c"; break; }
done
[[ -z "$ECO_CTX" ]] && \
  ECO_CTX=$(find "$ROOT/real-ecommerce-front" -name "auth-context.tsx" 2>/dev/null | head -1 || true)

if [[ -z "$ECO_CTX" ]]; then
  warn "No encontré auth-context.tsx en ecommerce-front — puede no tener auth propia (storefront público)"
else
  patch_auth_context "$ECO_CTX" "ecommerce-front auth-context.tsx"
fi

# =============================================================================
section "Resumen"
# =============================================================================

echo ""
echo "  Fix 1 — realsass-sass-back:"
echo "    ~ src/auth/auth.service.ts"
echo "      buildClaimsFromProfile(profile as unknown as ProfileForClaims)"
echo "      Resuelve TS2345: organization:unknown → Record<string,unknown>"
echo ""
echo "  Fix 2 — fronts (auth-context.tsx):"
echo "    ~ realsass-sass-front/context/auth-context.tsx"
echo "    ~ realsass-dashboard-front/.../auth-context.tsx"
echo "    ~ real-ecommerce-front/.../auth-context.tsx  (si existe)"
echo "      Agrega getIdToken(true) post-syncUser para claims frescos"
echo ""
echo "  Próximos pasos:"
echo "    git add ."
echo "    git commit -m 'fix: TS2345 claims cast + token refresh post-sync (ADR-003)'"
echo "    git push origin main"
echo ""
echo "  Verificación post-deploy:"
echo "    1. Logout → login de nuevo en sass-front"
echo "    2. Copiar Bearer del POST /auth/sync en Network tab"
echo "    3. curl https://chatia-backend-production.up.railway.app/api/v1/projects \\"
echo "         -H 'Authorization: Bearer TOKEN' \\"
echo "         -H 'x-organization-id: f8a5c145-6058-4fcd-8c42-30f9b4e0c792'"
echo "    4. Esperado: [] o lista — NO 403"
echo ""