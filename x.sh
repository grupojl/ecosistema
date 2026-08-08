#!/usr/bin/env bash
# =============================================================================
# x.sh — LIMPIEZA DE MÓDULOS AUTH
# Borra los archivos de auth (backs + fronts) para rehacer desde cero.
# Corre desde la raíz del monorepo: bash x.sh
#
# QUÉ HACE:
#   1. Borra archivos .bak (código zombie)
#   2. Vacía src/auth/ en sass-back (módulo completo)
#   3. Vacía src/users/ en sass-back (acoplado a auth)
#   4. Limpia firebase.module.ts en sass-back
#   5. Limpia common/guards y common/decorators en AMBOS backs
#   6. Elimina el router tRPC de auth en sass-back
#   7. Limpia el contexto de auth en dashboard-front
#   8. Limpia firebase.ts y api-client en dashboard-front
#   9. Deja app.module.ts y main.ts intactos (no los toca)
#  10. Imprime un resumen de qué quedó en pie
# =============================================================================

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${BLUE}[→]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
sep()  { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

# ─── Verificar que estamos en la raíz del monorepo ───────────────────────────
if [ ! -f "pnpm-workspace.yaml" ]; then
  err "Corré este script desde la raíz del monorepo (donde está pnpm-workspace.yaml)"
fi

sep
echo -e "${BOLD}  AUTH CLEANUP — pre-rebuild${NC}"
sep

# =============================================================================
# 1. ARCHIVOS .BAK — código zombie
# =============================================================================
log "Borrando archivos .bak..."

BAK_FILES=(
  "realsass-sass-back/src/auth/auth.controller.ts.bak"
  "realsass-sass-back/src/users/users.service.ts.bak"
)

for f in "${BAK_FILES[@]}"; do
  if [ -f "$f" ]; then
    rm "$f"
    ok "Borrado: $f"
  else
    warn "No encontrado (ya limpio): $f"
  fi
done

# =============================================================================
# 2. realsass-sass-back — módulo auth/ completo
# =============================================================================
sep
log "realsass-sass-back → borrando src/auth/..."

AUTH_BACK="realsass-sass-back/src/auth"

AUTH_FILES=(
  "auth.controller.ts"
  "auth.service.ts"
  "auth.module.ts"
)

for f in "${AUTH_FILES[@]}"; do
  if [ -f "$AUTH_BACK/$f" ]; then
    rm "$AUTH_BACK/$f"
    ok "Borrado: $AUTH_BACK/$f"
  else
    warn "No encontrado: $AUTH_BACK/$f"
  fi
done

# Si quedó vacío, borrar el directorio
if [ -d "$AUTH_BACK" ] && [ -z "$(ls -A "$AUTH_BACK")" ]; then
  rmdir "$AUTH_BACK"
  ok "Directorio vacío eliminado: $AUTH_BACK"
fi

# =============================================================================
# 3. realsass-sass-back — módulo users/ completo
# =============================================================================
log "realsass-sass-back → borrando src/users/..."

USERS_BACK="realsass-sass-back/src/users"

USERS_FILES=(
  "users.controller.ts"
  "users.service.ts"
  "users.module.ts"
)

# También puede haber DTOs dentro de users/dto/
if [ -d "$USERS_BACK/dto" ]; then
  rm -rf "$USERS_BACK/dto"
  ok "Borrado: $USERS_BACK/dto/"
fi

for f in "${USERS_FILES[@]}"; do
  if [ -f "$USERS_BACK/$f" ]; then
    rm "$USERS_BACK/$f"
    ok "Borrado: $USERS_BACK/$f"
  else
    warn "No encontrado: $USERS_BACK/$f"
  fi
done

if [ -d "$USERS_BACK" ] && [ -z "$(ls -A "$USERS_BACK")" ]; then
  rmdir "$USERS_BACK"
  ok "Directorio vacío eliminado: $USERS_BACK"
fi

# =============================================================================
# 4. realsass-sass-back — firebase.module.ts
# =============================================================================
log "realsass-sass-back → borrando src/firebase/..."

FIREBASE_MODULE="realsass-sass-back/src/firebase"

if [ -f "$FIREBASE_MODULE/firebase.module.ts" ]; then
  rm "$FIREBASE_MODULE/firebase.module.ts"
  ok "Borrado: $FIREBASE_MODULE/firebase.module.ts"
fi

if [ -d "$FIREBASE_MODULE" ] && [ -z "$(ls -A "$FIREBASE_MODULE")" ]; then
  rmdir "$FIREBASE_MODULE"
  ok "Directorio vacío eliminado: $FIREBASE_MODULE"
fi

# =============================================================================
# 5. realsass-sass-back — common/guards y common/decorators
# =============================================================================
log "realsass-sass-back → limpiando common/guards y common/decorators..."

SASS_GUARDS="realsass-sass-back/src/common/guards"
SASS_DECOS="realsass-sass-back/src/common/decorators"

GUARDS_TO_DELETE=(
  "$SASS_GUARDS/firebase-auth.guard.ts"
  "$SASS_GUARDS/roles.guard.ts"
)

DECOS_TO_DELETE=(
  "$SASS_DECOS/current-user.decorator.ts"
  "$SASS_DECOS/tenant.decorator.ts"
  "$SASS_DECOS/roles.decorator.ts"
  "$SASS_DECOS/public.decorator.ts"
)

for f in "${GUARDS_TO_DELETE[@]}" "${DECOS_TO_DELETE[@]}"; do
  if [ -f "$f" ]; then
    rm "$f"
    ok "Borrado: $f"
  else
    warn "No encontrado: $f"
  fi
done

# Borrar directorios si quedaron vacíos
for dir in "$SASS_GUARDS" "$SASS_DECOS"; do
  if [ -d "$dir" ] && [ -z "$(ls -A "$dir")" ]; then
    rmdir "$dir"
    ok "Directorio vacío eliminado: $dir"
  fi
done

# =============================================================================
# 6. realsass-sass-back — router tRPC de auth
# =============================================================================
log "realsass-sass-back → borrando src/trpc/routers/auth.router.ts..."

TRPC_AUTH="realsass-sass-back/src/trpc/routers/auth.router.ts"

if [ -f "$TRPC_AUTH" ]; then
  rm "$TRPC_AUTH"
  ok "Borrado: $TRPC_AUTH"
else
  warn "No encontrado: $TRPC_AUTH"
fi

# =============================================================================
# 7. realsass-ecommerce-back — common/guards y common/decorators (copias)
# =============================================================================
sep
log "realsass-ecommerce-back → limpiando common/guards y common/decorators..."

ECO_GUARDS="realsass-ecommerce-back/src/common/guards"
ECO_DECOS="realsass-ecommerce-back/src/common/decorators"

ECO_GUARDS_DELETE=(
  "$ECO_GUARDS/firebase-auth.guard.ts"
  "$ECO_GUARDS/roles.guard.ts"
  "$ECO_GUARDS/tenant.guard.ts"
)

ECO_DECOS_DELETE=(
  "$ECO_DECOS/current-user.decorator.ts"
  "$ECO_DECOS/tenant.decorator.ts"
  "$ECO_DECOS/roles.decorator.ts"
  "$ECO_DECOS/public.decorator.ts"
)

for f in "${ECO_GUARDS_DELETE[@]}" "${ECO_DECOS_DELETE[@]}"; do
  if [ -f "$f" ]; then
    rm "$f"
    ok "Borrado: $f"
  else
    warn "No encontrado: $f"
  fi
done

for dir in "$ECO_GUARDS" "$ECO_DECOS"; do
  if [ -d "$dir" ] && [ -z "$(ls -A "$dir")" ]; then
    rmdir "$dir"
    ok "Directorio vacío eliminado: $dir"
  fi
done

# =============================================================================
# 8. realsass-dashboard-front — contexto de auth
# =============================================================================
sep
log "realsass-dashboard-front → limpiando features/auth/..."

DASH_AUTH="realsass-dashboard-front/features/auth"

DASH_AUTH_FILES=(
  "context/auth-context.tsx"
  "components/login-form.tsx"
  "components/register-form.tsx"
  "components/index.ts"
)

for f in "${DASH_AUTH_FILES[@]}"; do
  full="$DASH_AUTH/$f"
  if [ -f "$full" ]; then
    rm "$full"
    ok "Borrado: $full"
  else
    warn "No encontrado: $full"
  fi
done

# Borrar subdirectorios vacíos dentro de features/auth
for sub in "context" "components"; do
  d="$DASH_AUTH/$sub"
  if [ -d "$d" ] && [ -z "$(ls -A "$d")" ]; then
    rmdir "$d"
    ok "Directorio vacío eliminado: $d"
  fi
done

if [ -d "$DASH_AUTH" ] && [ -z "$(ls -A "$DASH_AUTH")" ]; then
  rmdir "$DASH_AUTH"
  ok "Directorio vacío eliminado: $DASH_AUTH"
fi

# =============================================================================
# 9. realsass-dashboard-front — lib/firebase.ts y lib/api-client.ts
# =============================================================================
log "realsass-dashboard-front → limpiando lib/ relacionado a auth..."

DASH_LIB_FILES=(
  "realsass-dashboard-front/lib/firebase.ts"
  "realsass-dashboard-front/lib/api-client.ts"
)

for f in "${DASH_LIB_FILES[@]}"; do
  if [ -f "$f" ]; then
    rm "$f"
    ok "Borrado: $f"
  else
    warn "No encontrado: $f"
  fi
done

# =============================================================================
# 10. realsass-sass-front — hooks de auth (use-profile.ts)
# =============================================================================
log "realsass-sass-front → limpiando hooks/use-profile.ts..."

SASS_FRONT_HOOKS=(
  "realsass-sass-front/hooks/use-profile.ts"
)

for f in "${SASS_FRONT_HOOKS[@]}"; do
  if [ -f "$f" ]; then
    rm "$f"
    ok "Borrado: $f"
  else
    warn "No encontrado: $f"
  fi
done

# =============================================================================
# RESUMEN — qué quedó en pie (NO se tocó)
# =============================================================================
sep
echo -e "${BOLD}  RESUMEN — qué NO se tocó (intencional)${NC}"
sep

echo ""
echo -e "${YELLOW}  realsass-sass-back${NC}"
echo "    ├── src/app.module.ts               ← imports de AuthModule/UsersModule quedarán rotos hasta rebuild"
echo "    ├── src/trpc/trpc.module.ts          ← referencia a AuthService quedará rota hasta rebuild"
echo "    ├── src/trpc/app-router.ts           ← referencia a auth.router quedará rota hasta rebuild"
echo "    └── src/organizations/              ← tiene import de Public() → necesita nuevo public.decorator"
echo ""
echo -e "${YELLOW}  realsass-ecommerce-back${NC}"
echo "    ├── src/app.module.ts               ← FirebaseAuthGuard global → roto hasta rebuild"
echo "    ├── src/catalog/catalog.controller  ← usa TenantGuard + RolesGuard → rotos hasta rebuild"
echo "    └── src/common/types/tenant-context ← NO se borró, es un tipo puro sin dep de auth"
echo ""
echo -e "${YELLOW}  realsass-dashboard-front${NC}"
echo "    └── config/constants.ts             ← QUERY_KEYS sin cambios"
echo ""
echo -e "${RED}  ADVERTENCIA: El proyecto NO compila hasta que hagas el rebuild de auth.${NC}"
echo -e "${RED}  No hagas pnpm build ni deploy hasta tener los nuevos módulos en su lugar.${NC}"
echo ""
sep
echo -e "${GREEN}${BOLD}  Limpieza completa. Listo para planear y rehacer auth desde cero.${NC}"
sep