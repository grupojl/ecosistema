#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix TS2304 + TS2345 en auth.service.ts + token refresh en fronts
#
# Problema 1: ProfileForClaims no está exportada en claims.service.ts
#   → Exportarla + agregarla al import en auth.service.ts
#
# Problema 2: auth-context.tsx en 3 fronts sin getIdToken(true) post-sync
#   → sass-front, dashboard-front, ecommerce-front
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
section "Fix 1a — exportar ProfileForClaims en claims.service.ts"
# =============================================================================

CLAIMS="$ROOT/realsass-sass-back/src/auth/claims.service.ts"
[[ -f "$CLAIMS" ]] || err "No encontré $CLAIMS"

if grep -q 'export interface ProfileForClaims' "$CLAIMS"; then
  warn "ProfileForClaims ya está exportada — sin cambios"
else
  cp "$CLAIMS" "$CLAIMS.bak"
  echo "[→] backup → claims.service.ts.bak"

  node --eval "
const fs  = require('fs');
const src = fs.readFileSync('$CLAIMS', 'utf8');

// Cambiar 'interface ProfileForClaims' por 'export interface ProfileForClaims'
const result = src.replace(
  'interface ProfileForClaims',
  'export interface ProfileForClaims'
);

if (result === src) {
  console.error('WARN: patron interface ProfileForClaims no encontrado');
  process.exit(1);
}

fs.writeFileSync('$CLAIMS', result, 'utf8');
console.log('OK: ProfileForClaims exportada');
"
  ok "claims.service.ts — ProfileForClaims exportada"
fi

# =============================================================================
section "Fix 1b — agregar import de ProfileForClaims en auth.service.ts"
# =============================================================================

AUTH_SVC="$ROOT/realsass-sass-back/src/auth/auth.service.ts"
[[ -f "$AUTH_SVC" ]] || err "No encontré $AUTH_SVC"

cp "$AUTH_SVC" "$AUTH_SVC.bak"
echo "[→] backup → auth.service.ts.bak"

node --eval "
const fs  = require('fs');
const src = fs.readFileSync('$AUTH_SVC', 'utf8');
let result = src;

// 1. Asegurar que ProfileForClaims está en el import de claims.service
if (result.includes('ProfileForClaims')) {
  console.log('INFO: ProfileForClaims ya importada');
} else if (result.includes(\"from './claims.service'\")) {
  // Agregar al import existente
  result = result.replace(
    /import\s*\{([^}]+)\}\s*from\s*'\.\/claims\.service'/,
    (match, imports) => {
      const cleaned = imports.trim();
      return \`import { \${cleaned}, ProfileForClaims } from './claims.service'\`;
    }
  );
  console.log('OK: ProfileForClaims agregada al import');
} else {
  // No hay import de claims.service todavía — agregar al principio
  result = \"import { ProfileForClaims } from './claims.service';\n\" + result;
  console.log('OK: import de ProfileForClaims creado');
}

// 2. Reemplazar los casts as unknown as ProfileForClaims si ya están (del script anterior)
//    o agregar el cast correcto
result = result.replaceAll(
  'buildClaimsFromProfile(profile as unknown as ProfileForClaims)',
  'buildClaimsFromProfile(profile as unknown as ProfileForClaims)'
);

// 3. Si todavía tienen el cast correcto bien, no hacer nada más
// Si tienen el original sin cast, agregar
result = result.replaceAll(
  'buildClaimsFromProfile(profile)',
  'buildClaimsFromProfile(profile as unknown as ProfileForClaims)'
);

fs.writeFileSync('$AUTH_SVC', result, 'utf8');
console.log('OK: auth.service.ts actualizado');
"

ok "auth.service.ts corregido"

# =============================================================================
section "Fix 2 — getIdToken(true) post-syncUser en auth-context.tsx"
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
    warn "$LABEL no contiene 'await syncUser(' — saltando"
    return
  fi

  cp "$FILE" "$FILE.bak"
  echo "[→] backup → $(basename "$FILE").bak"

  node --eval "
const fs    = require('fs');
const lines = fs.readFileSync('$FILE', 'utf8').split('\n');
const INSERT = [
  '        // ADR-003: forzar refresh del token para incluir permissions.chat',
  '        // emitidos por ClaimsService. Sin esto chat-ia rechaza con 403.',
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
console.log('OK: fix aplicado');
"
  ok "$LABEL parcheado"
}

# sass-front
patch_auth_context \
  "$ROOT/realsass-sass-front/context/auth-context.tsx" \
  "sass-front"

# dashboard-front
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
[[ -n "$DASH_CTX" ]] && patch_auth_context "$DASH_CTX" "dashboard-front" || \
  warn "No encontré auth-context en dashboard-front"

# ecommerce-front
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
[[ -n "$ECO_CTX" ]] && patch_auth_context "$ECO_CTX" "ecommerce-front" || \
  warn "ecommerce-front sin auth-context (storefront público — esperado)"

# =============================================================================
section "Resumen"
# =============================================================================
echo ""
echo "  Archivos modificados:"
echo "    ~ realsass-sass-back/src/auth/claims.service.ts  (export ProfileForClaims)"
echo "    ~ realsass-sass-back/src/auth/auth.service.ts    (import + cast)"
echo "    ~ realsass-sass-front/context/auth-context.tsx"
echo "    ~ realsass-dashboard-front/.../auth-context.tsx"
echo "    ~ real-ecommerce-front/.../auth-context.tsx      (si existe)"
echo ""
echo "  Próximos pasos:"
echo "    git add ."
echo "    git commit -m 'fix: export ProfileForClaims + token refresh post-sync (ADR-003)'"
echo "    git push origin main"
echo ""
echo "  Verificación post-deploy (Railway sass-back en verde):"
echo "    1. Logout → login en sass-front"
echo "    2. Network → POST /auth/sync → copiar Bearer"
echo "    3. curl https://chatia-backend-production.up.railway.app/api/v1/projects \\"
echo "         -H 'Authorization: Bearer TOKEN' \\"
echo "         -H 'x-organization-id: f8a5c145-6058-4fcd-8c42-30f9b4e0c792'"
echo "    4. Esperado: [] o lista — NO 403"
echo ""