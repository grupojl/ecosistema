#!/usr/bin/env bash
# ==============================================================================
# x.sh — Aplicador de cambios por servicio · monorepo grupojl/welver
#
# CONTEXTO
#   Railway consume este mismo repo de GitHub como 5 servicios independientes.
#   Un cambio que toca varios directorios dispara N deploys simultáneos y hace
#   imposible aislar qué rompió qué. Este script aplica cambios de a UN target,
#   tocando SOLO los archivos de ese servicio, para que el path filter de
#   Railway/GitHub Actions dispare exactamente un deploy por corrida.
#
# USO
#   ./x.sh status                      # audita, no escribe nada
#   ./x.sh <target> [flags]
#   ./x.sh all --dry-run
#
# TARGETS
#   root             package.json raíz — pin de packageManager
#   packages         packages/trpc — alias AppRouter faltante
#   sass-back        realsass-sass-back
#   ecommerce-back   realsass-ecommerce-back
#   sass-front       realsass-sass-front
#   dashboard-front  realsass-dashboard-front
#   ecommerce-front  real-ecommerce-front
#   docs             .claude/** — audita midiendo el repo y regenera .claude/
#   clean            borra los .bak-* de corridas anteriores
#   all              todos, en orden de dependencia
#
# FLAGS
#   --dry-run        muestra el diff que haría, no escribe
#   --no-backup      no crea .bak
#   --force          aplica aunque los guards de verificación fallen
#   --commit         hace git add del scope + commit con mensaje por servicio
#
# ORDEN RECOMENDADO (un deploy verificado por vez)
#   ./x.sh packages --commit   → esperar CI verde
#   ./x.sh sass-front --commit → esperar deploy verde
#   ./x.sh ecommerce-back --commit
#   ...
#
# Entorno: Windows + Git Bash · Node 24.x · pnpm 10.x
# ==============================================================================

set -Eeuo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
readonly PNPM_VERSION="10.30.3"
readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TS="$(date +%Y%m%d-%H%M%S)"

DRY_RUN=0
BACKUP=1
FORCE=0
DO_COMMIT=0
TARGET=""
CHANGED_FILES=()
SKIPPED=()

# ── Salida ────────────────────────────────────────────────────────────────────
c_red=$'\033[0;31m'; c_grn=$'\033[0;32m'; c_yel=$'\033[0;33m'
c_blu=$'\033[0;34m'; c_dim=$'\033[2m';    c_off=$'\033[0m'

log()   { printf '%s\n' "$*"; }
ok()    { printf '%s  ✓%s %s\n' "$c_grn" "$c_off" "$*"; }
warn()  { printf '%s  ▲%s %s\n' "$c_yel" "$c_off" "$*"; }
err()   { printf '%s  ✗%s %s\n' "$c_red" "$c_off" "$*" >&2; }
skip()  { printf '%s  ·  %s%s\n' "$c_dim" "$*" "$c_off"; SKIPPED+=("$*"); }
head1() { printf '\n%s── %s %s%s\n' "$c_blu" "$*" "$(printf '─%.0s' $(seq 1 $((60 - ${#1}))))" "$c_off"; }

die() { err "$*"; exit 1; }

trap 'err "Fallo en la línea $LINENO. Nada más se aplicó. Revisá los .bak-$TS si existen."' ERR

# ── Helpers de escritura ──────────────────────────────────────────────────────

# write_file <path> <heredoc-content-via-stdin>
write_file() {
  local path="$1" tmp
  tmp="$(mktemp)"
  cat > "$tmp"

  if [[ -f "$ROOT/$path" ]] && cmp -s "$tmp" "$ROOT/$path"; then
    skip "$path ya está en el estado deseado"
    rm -f "$tmp"; return 0
  fi

  if (( DRY_RUN )); then
    log "${c_dim}  --- diff $path${c_off}"
    diff -u "$ROOT/$path" "$tmp" 2>/dev/null | sed 's/^/      /' || true
    rm -f "$tmp"; return 0
  fi

  mkdir -p "$(dirname "$ROOT/$path")"
  [[ -f "$ROOT/$path" && $BACKUP -eq 1 ]] && cp "$ROOT/$path" "$ROOT/$path.bak-$TS"
  mv "$tmp" "$ROOT/$path"
  CHANGED_FILES+=("$path")
  ok "escrito $path"
}

# patch_file <path> <sed-expr...> — edición in-place idempotente
patch_file() {
  local path="$1"; shift
  [[ -f "$ROOT/$path" ]] || { skip "$path no existe — nada que parchear"; return 0; }

  local tmp; tmp="$(mktemp)"
  cp "$ROOT/$path" "$tmp"
  local expr
  for expr in "$@"; do sed -i -E "$expr" "$tmp"; done

  if cmp -s "$tmp" "$ROOT/$path"; then
    skip "$path ya parcheado"
    rm -f "$tmp"; return 0
  fi

  if (( DRY_RUN )); then
    log "${c_dim}  --- diff $path${c_off}"
    diff -u "$ROOT/$path" "$tmp" | sed 's/^/      /' || true
    rm -f "$tmp"; return 0
  fi

  [[ $BACKUP -eq 1 ]] && cp "$ROOT/$path" "$ROOT/$path.bak-$TS"
  mv "$tmp" "$ROOT/$path"
  CHANGED_FILES+=("$path")
  ok "parcheado $path"
}

remove_file() {
  local path="$1" reason="${2:-}"
  [[ -e "$ROOT/$path" ]] || { skip "$path ya no existe"; return 0; }
  if (( DRY_RUN )); then log "${c_dim}  --- rm $path  ($reason)${c_off}"; return 0; fi
  [[ $BACKUP -eq 1 ]] && cp "$ROOT/$path" "$ROOT/$path.bak-$TS"
  rm -f "$ROOT/$path"
  CHANGED_FILES+=("$path")
  ok "eliminado $path  ${c_dim}($reason)${c_off}"
}

# guard <descripción> <comando...> — aborta si el estado real no es el esperado
guard() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then return 0; fi
  if (( FORCE )); then warn "guard falló: $desc — continuando por --force"; return 0; fi
  die "guard falló: $desc. El repo no está en el estado esperado. Revisá manualmente o usá --force."
}

commit_scope() {
  local scope="$1" msg="$2"
  (( DO_COMMIT )) || return 0
  (( DRY_RUN ))   && { log "${c_dim}  --- git commit -m \"$msg\" (dry-run)${c_off}"; return 0; }
  (( ${#CHANGED_FILES[@]} )) || { skip "sin cambios — no se commitea"; return 0; }
  ( cd "$ROOT" && git add -- "${CHANGED_FILES[@]}" && git commit -m "$msg" ) \
    && ok "commit creado — un solo path scope: $scope"
}

# ==============================================================================
# TARGET: root
# ==============================================================================
apply_root() {
  head1 "root — pin de toolchain"
  # Drift real detectado: Dockerfiles usan pnpm@10.11.1, nixpacks usa pnpm@latest,
  # el entorno local corre 10.30.3. `--frozen-lockfile` con 3 versiones distintas
  # de resolver es una bomba de tiempo en builds de Railway.
  if grep -q '"packageManager"' "$ROOT/package.json"; then
    skip "packageManager ya declarado en package.json"
  else
    patch_file "package.json" \
      "s/^(\s*)\"private\": true,/\1\"private\": true,\n\1\"packageManager\": \"pnpm@${PNPM_VERSION}\",/"
  fi
  warn "Después de esto: alinear a mano el 'corepack prepare pnpm@X' de los 5 Dockerfiles a ${PNPM_VERSION}."
  commit_scope "root" "chore(root): pin packageManager pnpm@${PNPM_VERSION}"
}

# ==============================================================================
# TARGET: packages
# ==============================================================================
apply_packages() {
  head1 "packages/trpc — alias AppRouter"
  local idx="packages/trpc/src/index.ts"
  guard "$idx existe" test -f "$ROOT/$idx"

  # BLOQUEANTE: realsass-sass-front/lib/config-client.ts hace
  #   import type { AppRouter } from '@real/trpc'
  # pero index.ts sólo exporta SassAppRouter y EcommerceAppRouter → TS2305,
  # el typecheck del front no compila.
  # Se agrega el alias como capa de compatibilidad y se corrige el import
  # en el target sass-front. El alias queda deprecado, no es la solución final.
  if grep -q "export type AppRouter" "$ROOT/$idx"; then
    skip "alias AppRouter ya exportado"
  else
    if (( DRY_RUN )); then
      log "${c_dim}  --- append alias AppRouter en $idx${c_off}"
    else
      [[ $BACKUP -eq 1 ]] && cp "$ROOT/$idx" "$ROOT/$idx.bak-$TS"
      cat >> "$ROOT/$idx" <<'TS'

// ── Alias de compatibilidad ───────────────────────────────────────────────────
// @deprecated Usar SassAppRouter. Existe sólo porque config-client.ts del
// sass-front importaba `AppRouter`, un símbolo que nunca se exportó (TS2305).
// Eliminar cuando no queden importadores: grep -rn "AppRouter[^SE]" */lib
export type AppRouter = _SassAppRouter;
TS
      CHANGED_FILES+=("$idx"); ok "alias AppRouter agregado en $idx"
    fi
  fi

  warn "ADR-013 pendiente: @real/trpc importa por ruta relativa '../../realsass-*-back/src/...'."
  warn "  El paquete no es autocontenido — cualquier build que no copie el back falla."
  commit_scope "packages" "fix(trpc): exportar alias AppRouter — corrige TS2305 en sass-front"
}

# ==============================================================================
# TARGET: sass-back
# ==============================================================================
apply_sass_back() {
  head1 "realsass-sass-back"
  local dto="realsass-sass-back/src/organizations/dto/update-organization.dto.ts"

  # E1-11 figura como done en lifecycle/05-tasks.md pero el archivo sigue vivo.
  # Sólo se elimina si nadie lo importa — si hay importadores, es trabajo manual.
  if [[ -f "$ROOT/$dto" ]]; then
    local users
    users="$(grep -rl "UpdateOrganizationDto" "$ROOT/realsass-sass-back/src" 2>/dev/null | grep -v "$dto" || true)"
    if [[ -n "$users" ]]; then
      warn "UpdateOrganizationDto todavía se importa — NO se elimina automáticamente:"
      printf '      %s\n' $users
      warn "  Migrar esos consumidores a Zod inline antes de correr esto de nuevo."
    else
      remove_file "$dto" "class-validator huérfano — E1-11"
    fi
  else
    skip "DTO class-validator ya eliminado"
  fi

  # .dockerignore: presente acá, ausente en ecommerce-back. Se deja como molde.
  guard ".dockerignore de sass-back existe" test -f "$ROOT/realsass-sass-back/.dockerignore"
  commit_scope "sass-back" "chore(sass-back): eliminar DTO class-validator huérfano (E1-11)"
}

# ==============================================================================
# TARGET: ecommerce-back
# ==============================================================================
apply_ecommerce_back() {
  head1 "realsass-ecommerce-back"
  local tsc="realsass-ecommerce-back/tsconfig.json"
  guard "$tsc existe" test -f "$ROOT/$tsc"

  # BLOQUEANTE de calidad: el tsconfig extiende tsconfig.base.json (strict: true)
  # y después lo desarma. AUDIT-LAST.md declara 10/10 en TypeScript Strict; el
  # archivo dice lo contrario. Esto es la razón por la que este servicio tolera
  # `any` implícito sin que el typecheck lo marque.
  if grep -q '"noImplicitAny": false' "$ROOT/$tsc"; then
    warn "ATENCIÓN: quitar noImplicitAny:false puede destapar decenas de errores."
    warn "  Corré 'pnpm --filter realsass-ecommerce-back typecheck' ANTES de commitear."
    patch_file "$tsc" \
      '/"noImplicitAny": false,?/d' \
      '/"strictBindCallApply": false,?/d' \
      '/"noFallthroughCasesInSwitch": false,?/d' \
      's/,(\s*)\}/\1}/'
  else
    skip "tsconfig ya hereda strict sin overrides"
  fi

  # Build context = raíz del monorepo. Sin .dockerignore, Docker sube node_modules,
  # .next y .git de los 5 servicios en cada build de Railway.
  if [[ ! -f "$ROOT/realsass-ecommerce-back/.dockerignore" ]]; then
    write_file "realsass-ecommerce-back/.dockerignore" <<'IGN'
# Build context = raíz del monorepo (welver/).
# Sin esto Docker sube node_modules y .next de los 5 servicios en cada deploy.
**/node_modules
**/dist
**/.next
**/.turbo
**/coverage
.git
.github
.claude
**/*.log
**/.env
**/.env.*
!**/.env.example
**/*.bak-*
IGN
  else
    skip ".dockerignore ya existe en ecommerce-back"
  fi

  commit_scope "ecommerce-back" "fix(ecommerce-back): restaurar strict heredado + .dockerignore"
}

# ==============================================================================
# TARGET: sass-front
# ==============================================================================
apply_sass_front() {
  head1 "realsass-sass-front"

  # Corrige el import roto en el origen (el alias en @real/trpc es sólo la red).
  patch_file "realsass-sass-front/lib/config-client.ts" \
    "s/import type \{ AppRouter \} from '@real\/trpc'/import type { SassAppRouter } from '@real\/trpc'/" \
    "s/\bAppRouter\b/SassAppRouter/g"

  fix_front_deploy_config "realsass-sass-front"
  commit_scope "sass-front" "fix(sass-front): importar SassAppRouter — corrige typecheck"
}

# ==============================================================================
# TARGET: dashboard-front
# ==============================================================================
apply_dashboard_front() {
  head1 "realsass-dashboard-front"
  # Único servicio sin railway.json: Railway cae a autodetección de builder,
  # que no es el Dockerfile que sí existe en el repo.
  if [[ ! -f "$ROOT/realsass-dashboard-front/railway.json" ]]; then
    write_file "realsass-dashboard-front/railway.json" <<'JSON'
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "realsass-dashboard-front/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
JSON
  else
    skip "railway.json ya existe"
  fi
  fix_front_deploy_config "realsass-dashboard-front"
  commit_scope "dashboard-front" "chore(dashboard-front): railway.json con builder DOCKERFILE"
}

# ==============================================================================
# TARGET: ecommerce-front
# ==============================================================================
apply_ecommerce_front() {
  head1 "real-ecommerce-front"
  if [[ ! -f "$ROOT/real-ecommerce-front/.dockerignore" ]]; then
    write_file "real-ecommerce-front/.dockerignore" <<'IGN'
# Build context = raíz del monorepo (welver/).
**/node_modules
**/dist
**/.next
**/.turbo
**/coverage
.git
.github
.claude
**/*.log
**/.env
**/.env.*
!**/.env.example
**/*.bak-*
IGN
  else
    skip ".dockerignore ya existe"
  fi
  fix_front_deploy_config "real-ecommerce-front"

  warn "GAP abierto — HydrationBoundary: 0 ocurrencias en las 4 páginas de tienda/[slug]."
  warn "  No lo aplica este script: requiere prefetchQuery por página, no es sed."
  commit_scope "ecommerce-front" "chore(ecommerce-front): .dockerignore + limpieza de config de deploy"
}

# ── Común a los 3 fronts ──────────────────────────────────────────────────────
fix_front_deploy_config() {
  local svc="$1"
  # nixpacks.toml + railway.json{builder:DOCKERFILE} coexisten: nixpacks queda
  # muerto pero describe un arranque distinto (standalone/server.js) al del
  # Dockerfile (next start). Dos fuentes de verdad contradictorias sobre cómo
  # arranca el servicio es exactamente lo que hace irreproducible un incidente.
  if [[ -f "$ROOT/$svc/nixpacks.toml" && -f "$ROOT/$svc/railway.json" ]] \
     && grep -q '"DOCKERFILE"' "$ROOT/$svc/railway.json"; then
    remove_file "$svc/nixpacks.toml" "railway.json ya fuerza builder DOCKERFILE"
  else
    skip "$svc — sin conflicto nixpacks/railway"
  fi
}

# ==============================================================================
# TARGET: clean — borra los .bak-* que dejan las corridas anteriores
# ==============================================================================
apply_clean() {
  head1 "clean — backups de corridas anteriores"
  local n
  n=$(find "$ROOT" -name '*.bak-*' -not -path '*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')
  (( n )) || { skip "no hay .bak-* que limpiar"; return 0; }
  if (( DRY_RUN )); then
    find "$ROOT" -name '*.bak-*' -not -path '*/node_modules/*' | sed "s|$ROOT/|      rm |"
    return 0
  fi
  find "$ROOT" -name '*.bak-*' -not -path '*/node_modules/*' -delete
  ok "$n backups eliminados"
}

# ==============================================================================
# TARGET: status — auditoría de sólo lectura
# ==============================================================================
run_status() {
  head1 "status — verificación de sólo lectura"
  local fail=0
  chk() { # chk <descripción> <esperado:ok|bad> <comando...>
    local d="$1" exp="$2"; shift 2
    if "$@" >/dev/null 2>&1; then
      [[ $exp == ok ]] && ok "$d" || { err "$d"; fail=1; }
    else
      [[ $exp == bad ]] && ok "$d" || { err "$d"; fail=1; }
    fi
  }

  chk "tsconfig.base.json con strict:true"                ok  grep -q '"strict": true' "$ROOT/tsconfig.base.json"
  chk "ecommerce-back SIN noImplicitAny:false"            bad grep -q '"noImplicitAny": false' "$ROOT/realsass-ecommerce-back/tsconfig.json"
  chk "0 'as any' reales en backs (ignora comentarios)"    bad bash -c "grep -rn ' as any' '$ROOT/realsass-sass-back/src' '$ROOT/realsass-ecommerce-back/src' 2>/dev/null | grep -v -E '^[^:]+:[0-9]+: *(\\*|//|/\\*)' | grep -q ."
  chk "0 class-validator en sass-back"                    bad grep -rq "from 'class-validator'" "$ROOT/realsass-sass-back/src"
  chk "@real/trpc exporta AppRouter"                      ok  grep -q "export type AppRouter" "$ROOT/packages/trpc/src/index.ts"
  chk "helmet en sass-back"                               ok  grep -q "helmet" "$ROOT/realsass-sass-back/src/main.ts"
  chk "helmet en ecommerce-back"                          ok  grep -q "helmet" "$ROOT/realsass-ecommerce-back/src/main.ts"
  chk "@Throttle en auth.controller"                      ok  grep -q "Throttle" "$ROOT/realsass-sass-back/src/auth/auth.controller.ts"
  chk "migrate deploy en Dockerfile sass-back"            ok  grep -q "migrate deploy" "$ROOT/realsass-sass-back/Dockerfile"
  chk "migrate deploy en Dockerfile ecommerce-back"       ok  grep -q "migrate deploy" "$ROOT/realsass-ecommerce-back/Dockerfile"
  chk ".dockerignore en ecommerce-back"                   ok  test -f "$ROOT/realsass-ecommerce-back/.dockerignore"
  chk ".dockerignore en ecommerce-front"                  ok  test -f "$ROOT/real-ecommerce-front/.dockerignore"
  chk "railway.json en dashboard-front"                   ok  test -f "$ROOT/realsass-dashboard-front/railway.json"
  chk "sin named catalogs en pnpm-workspace"              bad grep -qE '^catalogs:' "$ROOT/pnpm-workspace.yaml"
  chk "packageManager pinneado"                           ok  grep -q '"packageManager"' "$ROOT/package.json"
  chk "HydrationBoundary en ecommerce-front"              ok  grep -rq "HydrationBoundary" "$ROOT/real-ecommerce-front"
  chk "existen tests (*.spec.ts)"                         ok  bash -c "find '$ROOT' -name '*.spec.ts' -not -path '*/node_modules/*' | grep -q ."
  chk "existen workflows de CI"                           ok  bash -c "ls '$ROOT'/.github/workflows/*.yml >/dev/null 2>&1"
  chk ".env.example en sass-back"                         ok  test -f "$ROOT/realsass-sass-back/.env.example"
  chk ".env.example en ecommerce-back"                    ok  test -f "$ROOT/realsass-ecommerce-back/.env.example"

  log ""
  (( fail )) && warn "Hay checks en rojo — son las tasks abiertas, no errores del script." \
             || ok "Todos los checks en verde."
  return 0
}

# ==============================================================================
# MOTOR DE MEDICIÓN — todo lo que alimenta el score sale de acá.
#
# Regla: ninguna función de acá escribe. Sólo miden y exportan variables M_*.
# Si algo no se puede medir, la variable queda en -1 y el reporte lo marca
# como no verificado en vez de asumir verde.
# ==============================================================================

# Conteos crudos ---------------------------------------------------------------
count_files()  { find "$ROOT/$1" -type f -name "$2" -not -path '*/node_modules/*' \
                   -not -path '*/dist/*' -not -path '*/.next/*' 2>/dev/null | wc -l | tr -d ' '; }

# grep -rn filtrando líneas que son comentario (`*`, `//`, `/*`)
grep_code() {
  local pat="$1"; shift
  grep -rn --include='*.ts' --include='*.tsx' -E "$pat" "$@" 2>/dev/null \
    | grep -vE '^[^:]+:[0-9]+: *(\*|//|/\*)' || true
}

measure() {
  head1 "midiendo el repo"
  # Las mediciones son best-effort: un grep sin hits o un directorio ausente es
  # un dato válido (cero), no un fallo. set -e y el trap se reactivan al salir.
  set +e; trap - ERR

  # ── D1 · TypeScript strict ──────────────────────────────────────────────────
  M_NOIMPLICITANY=0
  grep -q '"noImplicitAny": *false' "$ROOT/realsass-ecommerce-back/tsconfig.json" 2>/dev/null && M_NOIMPLICITANY=1
  grep -q '"noImplicitAny": *false' "$ROOT/realsass-sass-back/tsconfig.json"      2>/dev/null && M_NOIMPLICITANY=1

  M_ASANY=$(grep_code ' as any|: any\b|<any>' \
              "$ROOT/realsass-sass-back/src" "$ROOT/realsass-ecommerce-back/src" | wc -l | tr -d ' ')
  M_ASANY_JUSTIF=$(grep_code ' as any' \
              "$ROOT/realsass-sass-back/src" "$ROOT/realsass-ecommerce-back/src" \
              | grep -c '@real/jsonb-cast' || true)
  M_CLASSVAL=$(grep -rl "from 'class-validator'" \
              "$ROOT/realsass-sass-back/src" "$ROOT/realsass-ecommerce-back/src" 2>/dev/null | wc -l | tr -d ' ')

  # ── D2 · Capas backend ──────────────────────────────────────────────────────
  M_SB_MODULES=0; M_SB_DR=0
  for d in "$ROOT/realsass-sass-back/src"/*/; do
    case "$(basename "$d")" in common|prisma|redis|trpc|health|config-cache) continue ;; esac
    M_SB_MODULES=$((M_SB_MODULES+1))
    [[ -d "$d/domain" && -d "$d/repository" ]] && M_SB_DR=$((M_SB_DR+1))
  done
  M_EB_MODULES=0; M_EB_DR=0
  for d in "$ROOT/realsass-ecommerce-back/src"/*/; do
    case "$(basename "$d")" in common|prisma|redis|trpc|health|organizations-client) continue ;; esac
    M_EB_MODULES=$((M_EB_MODULES+1))
    [[ -d "$d/domain" && -d "$d/repository" ]] && M_EB_DR=$((M_EB_DR+1))
  done
  # services que inyectan PrismaService (excluye el propio prisma.service.ts)
  M_PRISMA_IN_SVC=$(grep -rl "PrismaService" \
      "$ROOT/realsass-sass-back/src" "$ROOT/realsass-ecommerce-back/src" \
      --include='*.service.ts' 2>/dev/null | grep -vc 'prisma/prisma.service.ts' || true)
  M_ANYROUTER=$(grep_code 'AnyRouter| as any' "$ROOT/packages/trpc/src" | wc -l | tr -d ' ')

  # ── D3 · Frontend ───────────────────────────────────────────────────────────
  M_HYDRATION=$(grep -rl "HydrationBoundary" \
      "$ROOT/real-ecommerce-front" "$ROOT/realsass-sass-front" "$ROOT/realsass-dashboard-front" \
      --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
  M_STORE_PAGES=$(count_files "real-ecommerce-front/app" "page.tsx")
  M_RAWFETCH=$(grep_code '(^|[^a-zA-Z])fetch\(' \
      "$ROOT/realsass-sass-front/hooks" "$ROOT/realsass-dashboard-front/hooks" 2>/dev/null | wc -l | tr -d ' ')
  M_TRPC_IMPORT_OK=1
  grep -rq "import type { AppRouter }" "$ROOT/realsass-sass-front" 2>/dev/null \
    && ! grep -q "export type AppRouter" "$ROOT/packages/trpc/src/index.ts" 2>/dev/null \
    && M_TRPC_IMPORT_OK=0

  # ── D4 · Seguridad ──────────────────────────────────────────────────────────
  M_HELMET=0
  grep -q helmet "$ROOT/realsass-sass-back/src/main.ts"      2>/dev/null && M_HELMET=$((M_HELMET+1))
  grep -q helmet "$ROOT/realsass-ecommerce-back/src/main.ts" 2>/dev/null && M_HELMET=$((M_HELMET+1))
  M_THROTTLE=0; grep -rq "Throttle" "$ROOT/realsass-sass-back/src/auth" 2>/dev/null && M_THROTTLE=1
  M_MIGRATE=0
  for f in realsass-sass-back realsass-ecommerce-back; do
    grep -q "migrate deploy" "$ROOT/$f/Dockerfile" 2>/dev/null && M_MIGRATE=$((M_MIGRATE+1))
  done
  M_DOCKERIGNORE=0
  for f in realsass-sass-back realsass-ecommerce-back realsass-sass-front \
           realsass-dashboard-front real-ecommerce-front; do
    [[ -f "$ROOT/$f/.dockerignore" ]] && M_DOCKERIGNORE=$((M_DOCKERIGNORE+1))
  done
  M_CORS_WILDCARD=$(grep -rn "origin: *'\*'" "$ROOT"/realsass-*-back/src/main.ts 2>/dev/null | wc -l | tr -d ' ')
  M_RAWQUERY=$(grep_code '\$queryRaw|\$executeRaw' \
      "$ROOT/realsass-sass-back/src" "$ROOT/realsass-ecommerce-back/src" | wc -l | tr -d ' ')

  # ── D5 · Config y entorno ───────────────────────────────────────────────────
  # Exigible en los 2 backs. Los fronts reciben NEXT_PUBLIC_* como build args
  # en Railway, así que no se penalizan; se cuentan aparte como bonus informativo.
  M_ENVEXAMPLE=0
  for f in realsass-sass-back realsass-ecommerce-back; do
    [[ -f "$ROOT/$f/.env.example" ]] && M_ENVEXAMPLE=$((M_ENVEXAMPLE+1))
  done
  M_ENVEXAMPLE_FRONT=0
  for f in realsass-sass-front realsass-dashboard-front real-ecommerce-front; do
    [[ -f "$ROOT/$f/.env.example" ]] && M_ENVEXAMPLE_FRONT=$((M_ENVEXAMPLE_FRONT+1))
  done
  M_ENVGUARD=0
  for f in realsass-sass-back realsass-ecommerce-back; do
    grep -qE "process\.exit|REQUIRED_ENV|faltante|Validación de variables" "$ROOT/$f/src/main.ts" 2>/dev/null \
      && M_ENVGUARD=$((M_ENVGUARD+1))
  done
  M_PKGMGR=0; grep -q '"packageManager"' "$ROOT/package.json" && M_PKGMGR=1
  M_NAMEDCAT=0; grep -qE '^catalogs:' "$ROOT/pnpm-workspace.yaml" && M_NAMEDCAT=1
  M_RAILWAY_JSON=0; M_NIXPACKS_CONFLICT=0
  for f in realsass-sass-back realsass-ecommerce-back realsass-sass-front \
           realsass-dashboard-front real-ecommerce-front; do
    [[ -f "$ROOT/$f/railway.json" ]] && M_RAILWAY_JSON=$((M_RAILWAY_JSON+1))
    [[ -f "$ROOT/$f/nixpacks.toml" && -f "$ROOT/$f/railway.json" ]] \
      && grep -q '"DOCKERFILE"' "$ROOT/$f/railway.json" 2>/dev/null \
      && M_NIXPACKS_CONFLICT=$((M_NIXPACKS_CONFLICT+1))
  done
  # drift de pnpm entre Dockerfiles / nixpacks / packageManager
  M_PNPM_VERSIONS=$( { grep -rhoE 'pnpm@[0-9]+\.[0-9]+\.[0-9]+|pnpm@latest' "$ROOT"/*/Dockerfile \
        "$ROOT"/*/nixpacks.toml "$ROOT/package.json" 2>/dev/null; } | sort -u | wc -l | tr -d ' ')

  # ── D6 · CI/CD y tests ──────────────────────────────────────────────────────
  M_WORKFLOWS=$(ls "$ROOT"/.github/workflows/*.y*ml 2>/dev/null | wc -l | tr -d ' ')
  M_WF_TYPECHECK=$(grep -l "typecheck" "$ROOT"/.github/workflows/*.y*ml 2>/dev/null | wc -l | tr -d ' ')
  M_WF_PATHS=$(grep -l "paths:" "$ROOT"/.github/workflows/*.y*ml 2>/dev/null | wc -l | tr -d ' ')
  M_WF_TESTS=$(grep -lE "run:.*(jest|vitest|pnpm.*test)" "$ROOT"/.github/workflows/*.y*ml 2>/dev/null | wc -l | tr -d ' ')
  M_WF_AUDIT=$(grep -l "pnpm audit" "$ROOT"/.github/workflows/*.y*ml 2>/dev/null | wc -l | tr -d ' ')
  M_SPEC_BACK=$(( $(count_files "realsass-sass-back" "*.spec.ts") + $(count_files "realsass-ecommerce-back" "*.spec.ts") ))
  M_SPEC_FRONT=$(( $(count_files "realsass-sass-front" "*.test.tsx") \
                 + $(count_files "realsass-dashboard-front" "*.test.tsx") \
                 + $(count_files "real-ecommerce-front" "*.test.tsx") \
                 + $(count_files "real-ecommerce-front" "*.spec.ts") ))
  M_SPEC_E2E=$(count_files "." "*.e2e-spec.ts")
  M_COV_THRESHOLD=$(grep -rl "coverageThreshold" "$ROOT"/realsass-*-back 2>/dev/null \
                    --include='package.json' --include='jest.config*' | wc -l | tr -d ' ')
  # denominador para densidad de tests: services + routers de negocio
  M_TESTABLE=$(( $(count_files "realsass-sass-back/src" "*.service.ts") \
               + $(count_files "realsass-ecommerce-back/src" "*.service.ts") \
               + $(count_files "realsass-sass-back/src" "*.router.ts") \
               + $(count_files "realsass-ecommerce-back/src" "*.router.ts") ))

  # ── D7 · Observabilidad y deuda ─────────────────────────────────────────────
  M_OTEL=$(grep -rl "opentelemetry\|prom-client\|correlationId" \
      "$ROOT/realsass-sass-back/src" "$ROOT/realsass-ecommerce-back/src" \
      --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
  M_LEGACY=$(grep_code '@/lib/ecommerce|catalog-header|product-gallery' \
      "$ROOT/real-ecommerce-front" | wc -l | tr -d ' ')
  M_TODO=$(grep_code 'TODO|FIXME|HACK' \
      "$ROOT/realsass-sass-back/src" "$ROOT/realsass-ecommerce-back/src" | wc -l | tr -d ' ')
  M_BAK=$(find "$ROOT" -name '*.bak-*' -not -path '*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')

  trap 'err "Fallo en la línea $LINENO."' ERR; set -e
  # normalizar: cualquier medición vacía cuenta como 0
  local v
  for v in $(compgen -v M_); do [[ -z "${!v}" ]] && printf -v "$v" '%s' 0; done

  ok "mediciones completas — $M_SB_MODULES+$M_EB_MODULES módulos, $((M_SPEC_BACK+M_SPEC_FRONT)) tests, $M_WORKFLOWS workflows"
}

# ── Rúbrica: mediciones → score por dimensión ────────────────────────────────
# Cada dimensión arranca en 10 y descuenta. Los descuentos replican la rúbrica
# de .claude/AUDIT.md. Se calcula con awk porque bash no hace decimales.
score() { awk -v s="$1" 'BEGIN{ if(s<0)s=0; if(s>10)s=10; printf "%.1f", s }'; }

compute_scores() {
  set +e; trap - ERR
  local d
  # D1 — TypeScript strict
  d=10
  (( M_NOIMPLICITANY )) && d=$(awk -v d=$d 'BEGIN{print d-5}')
  (( M_CLASSVAL ))      && d=$(awk -v d=$d -v n=$M_CLASSVAL 'BEGIN{print d-(n>2?2:n*1.0)}')
  local anyunjust=$(( M_ASANY - M_ASANY_JUSTIF )); (( anyunjust < 0 )) && anyunjust=0
  (( anyunjust ))       && d=$(awk -v d=$d -v n=$anyunjust 'BEGIN{print d-(n>6?3:n*0.5)}')
  S1=$(score "$d")

  # D2 — Capas backend
  d=$(awk -v a=$M_SB_DR -v b=$M_SB_MODULES -v c=$M_EB_DR -v e=$M_EB_MODULES \
        'BEGIN{ t=b+e; if(t==0){print 0; exit} print 10*(a+c)/t }')
  (( M_PRISMA_IN_SVC > 1 )) && d=$(awk -v d=$d -v n=$M_PRISMA_IN_SVC 'BEGIN{print d-((n-1)*0.3>2?2:(n-1)*0.3)}')
  (( M_ANYROUTER ))         && d=$(awk -v d=$d 'BEGIN{print d-1}')
  # el andamiaje de capas 1/2/5 vale aunque falte D+R en algún módulo
  d=$(awk -v d=$d 'BEGIN{print d*0.75 + 2.5}')
  S2=$(score "$d")

  # D3 — Frontend
  d=10
  (( M_HYDRATION == 0 ))   && d=$(awk -v d=$d 'BEGIN{print d-2.5}')
  (( M_RAWFETCH ))         && d=$(awk -v d=$d -v n=$M_RAWFETCH 'BEGIN{print d-(n>4?2:n*0.5)}')
  (( M_TRPC_IMPORT_OK==0 ))&& d=$(awk -v d=$d 'BEGIN{print d-1.5}')
  S3=$(score "$d")

  # D4 — Seguridad
  d=10
  (( M_HELMET < 2 ))        && d=$(awk -v d=$d -v n=$M_HELMET 'BEGIN{print d-(2-n)*1.5}')
  (( M_THROTTLE == 0 ))     && d=$(awk -v d=$d 'BEGIN{print d-1.5}')
  (( M_MIGRATE < 2 ))       && d=$(awk -v d=$d -v n=$M_MIGRATE 'BEGIN{print d-(2-n)*1}')
  (( M_CORS_WILDCARD ))     && d=$(awk -v d=$d 'BEGIN{print d-2}')
  (( M_DOCKERIGNORE < 5 ))  && d=$(awk -v d=$d -v n=$M_DOCKERIGNORE 'BEGIN{print d-(5-n)*0.3}')
  (( M_WF_AUDIT == 0 ))     && d=$(awk -v d=$d 'BEGIN{print d-0.5}')
  S4=$(score "$d")

  # D5 — Config y entorno
  d=10
  (( M_ENVEXAMPLE < 2 ))       && d=$(awk -v d=$d -v n=$M_ENVEXAMPLE 'BEGIN{print d-(2-n)*1.2}')
  (( M_ENVGUARD < 2 ))         && d=$(awk -v d=$d -v n=$M_ENVGUARD 'BEGIN{print d-(2-n)*1}')
  (( M_PKGMGR == 0 ))          && d=$(awk -v d=$d 'BEGIN{print d-0.8}')
  (( M_NAMEDCAT ))             && d=$(awk -v d=$d 'BEGIN{print d-2}')
  (( M_NIXPACKS_CONFLICT ))    && d=$(awk -v d=$d -v n=$M_NIXPACKS_CONFLICT 'BEGIN{print d-n*0.5}')
  (( M_RAILWAY_JSON < 5 ))     && d=$(awk -v d=$d -v n=$M_RAILWAY_JSON 'BEGIN{print d-(5-n)*0.4}')
  (( M_PNPM_VERSIONS > 1 ))    && d=$(awk -v d=$d -v n=$M_PNPM_VERSIONS 'BEGIN{print d-(n-1)*0.5}')
  S5=$(score "$d")

  # D6 — CI/CD y tests
  d=0
  (( M_WORKFLOWS ))     && d=$(awk -v d=$d -v n=$M_WORKFLOWS 'BEGIN{print d+(n>=5?3:n*0.6)}')
  (( M_WF_TYPECHECK ))  && d=$(awk -v d=$d 'BEGIN{print d+1}')
  (( M_WF_PATHS ))      && d=$(awk -v d=$d 'BEGIN{print d+1}')
  (( M_WF_TESTS ))      && d=$(awk -v d=$d 'BEGIN{print d+1.5}')
  # densidad: tests sobre unidades testeables (services + routers)
  d=$(awk -v d=$d -v t=$((M_SPEC_BACK+M_SPEC_FRONT+M_SPEC_E2E)) -v u=$M_TESTABLE \
        'BEGIN{ r=(u>0? t/u : 0); if(r>1)r=1; print d + r*2.5 }')
  (( M_COV_THRESHOLD )) && d=$(awk -v d=$d 'BEGIN{print d+1}')
  S6=$(score "$d")

  # D7 — Deuda técnica
  d=10
  (( M_LEGACY ))                && d=$(awk -v d=$d -v n=$M_LEGACY 'BEGIN{print d-n*0.5}')
  local missing_dr=$(( (M_SB_MODULES-M_SB_DR) + (M_EB_MODULES-M_EB_DR) ))
  (( missing_dr ))              && d=$(awk -v d=$d -v n=$missing_dr 'BEGIN{print d-(n*0.3>2.5?2.5:n*0.3)}')
  (( M_NOIMPLICITANY ))         && d=$(awk -v d=$d 'BEGIN{print d-1}')
  (( M_OTEL == 0 ))             && d=$(awk -v d=$d 'BEGIN{print d-1}')
  (( M_TODO > 10 ))             && d=$(awk -v d=$d 'BEGIN{print d-0.5}')
  (( M_BAK ))                   && d=$(awk -v d=$d 'BEGIN{print d-0.5}')
  (( M_TRPC_IMPORT_OK == 0 ))   && d=$(awk -v d=$d 'BEGIN{print d-1}')
  S7=$(score "$d")

  trap 'err "Fallo en la línea $LINENO."' ERR; set -e
  GLOBAL=$(awk -v a=$S1 -v b=$S2 -v c=$S3 -v e=$S4 -v f=$S5 -v g=$S6 -v h=$S7 \
    'BEGIN{printf "%.2f", a*0.15+b*0.20+c*0.15+e*0.15+f*0.10+g*0.10+h*0.15}')
}

# ── Marcado de checkboxes en 05-tasks.md ─────────────────────────────────────
# Marca [x] sólo lo que una medición respalda. Nunca desmarca a mano:
# si una task deja de cumplirse, la próxima corrida la vuelve a [ ].
mark_task() { # mark_task <ID> <0|1>
  local id="$1" done_="$2" f="$ROOT/.claude/lifecycle/05-tasks.md"
  [[ -f "$f" ]] || return 0
  local box="[ ]"; (( done_ )) && box="[x]"
  sed -i -E "s/^- \[[ x]\] \*\*\[$id\]\*\*/- $box **[$id]**/" "$f"
}

sync_tasks() {
  local f="$ROOT/.claude/lifecycle/05-tasks.md"
  [[ -f "$f" ]] || { skip "05-tasks.md no existe"; return 0; }
  (( DRY_RUN )) && { log "${c_dim}  --- se marcarían checkboxes en 05-tasks.md${c_off}"; return 0; }
  [[ $BACKUP -eq 1 ]] && cp "$f" "$f.bak-$TS"

  local no_rest=0
  [[ $(ls "$ROOT"/realsass-ecommerce-back/src/*/*.controller.ts 2>/dev/null | wc -l) -eq 0 ]] && no_rest=1
  local dto_gone=0
  [[ ! -f "$ROOT/realsass-sass-back/src/organizations/dto/update-organization.dto.ts" ]] && dto_gone=1

  mark_task E1-01 "$no_rest";  mark_task E1-02 "$no_rest"
  mark_task E1-03 "$no_rest";  mark_task E1-04 "$no_rest"
  mark_task E1-10 "$no_rest";  mark_task E1-11 "$dto_gone"
  mark_task E1-12 "$([[ -d "$ROOT/realsass-ecommerce-back/src/cart/domain" ]] && echo 1 || echo 0)"
  mark_task E1-13 "$([[ -d "$ROOT/realsass-ecommerce-back/src/orders/domain" ]] && echo 1 || echo 0)"
  mark_task E1-14 "$([[ -d "$ROOT/realsass-ecommerce-back/src/customers/domain" ]] && echo 1 || echo 0)"
  mark_task E1-15 "$([[ -d "$ROOT/realsass-ecommerce-back/src/inventory/domain" ]] && echo 1 || echo 0)"
  mark_task E2-02 "$(( M_ENVEXAMPLE >= 2 ? 1 : 0 ))"
  mark_task E2-03 "$(( M_ENVGUARD  >= 2 ? 1 : 0 ))"
  mark_task E4-02 "$(( M_MIGRATE   >= 2 ? 1 : 0 ))"
  mark_task E3-01 "$(( M_HELMET    >= 2 ? 1 : 0 ))"
  mark_task E3-02 "$M_THROTTLE"; mark_task E3-03 "$M_THROTTLE"
  for i in 01 02 03 04 05 06; do
    mark_task "E5-$i" "$(( M_WORKFLOWS >= 5 ? 1 : 0 ))"
  done
  mark_task E5-07 "$(( M_WF_PATHS >= 5 ? 1 : 0 ))"
  mark_task E7-01 "$(( M_WF_AUDIT > 0 ? 1 : 0 ))"
  mark_task E6-01 "$(( M_OTEL > 0 ? 1 : 0 ))"
  mark_task E6-02 "$(( M_OTEL > 0 ? 1 : 0 ))"
  mark_task E11-02 "$(( M_HYDRATION > 0 ? 1 : 0 ))"

  # recalcular la tabla de progreso
  # borrar el footer de la corrida anterior para no acumularlos
  sed -i '/<!-- generado por x.sh docs/,$d' "$f"
  local tot don
  tot=$(grep -c '^- \[[ x]\] \*\*\[' "$f" || echo 0)
  don=$(grep -c '^- \[x\] \*\*\['     "$f" || echo 0)
  local pct; pct=$(awk -v d="$don" -v t="$tot" 'BEGIN{printf "%d", (t>0? d*100/t : 0)}')
  printf '\n<!-- generado por x.sh docs · %s -->\n> **Progreso verificado:** %s/%s tasks (%s%%). Marcado por medición, no por declaración.\n' \
    "$(date +%F)" "$don" "$tot" "$pct" >> "$f"
  CHANGED_FILES+=(".claude/lifecycle/05-tasks.md")
  ok "05-tasks.md sincronizado — $don/$tot verificadas ($pct%)"
}

# ==============================================================================
# TARGET: docs — genera .claude/ desde las mediciones
# ==============================================================================
apply_docs() {
  measure
  compute_scores

  head1 ".claude — auditoría generada por medición"
  log "  D1 TypeScript strict ....... $S1"
  log "  D2 Capas backend ........... $S2"
  log "  D3 Frontend ................ $S3"
  log "  D4 Seguridad ............... $S4"
  log "  D5 Config/entorno .......... $S5"
  log "  D6 CI/CD y tests ........... $S6"
  log "  D7 Deuda técnica ........... $S7"
  log ""
  ok  "SCORE GLOBAL: $GLOBAL/10"

  # Score anterior — tolera el formato viejo (9.01/10) y el generado (**6.91**)
  local prev=""
  if [[ -f "$ROOT/.claude/AUDIT-LAST.md" ]]; then
    prev=$(grep -oE 'Score global:[^0-9]*[0-9]+\.[0-9]+' "$ROOT/.claude/AUDIT-LAST.md" 2>/dev/null \
             | grep -oE '[0-9]+\.[0-9]+' | head -1) || true
  fi
  local delta="n/d"
  if [[ -n "$prev" ]]; then
    delta=$(awk -v a="$GLOBAL" -v b="$prev" 'BEGIN{printf "%+.2f", a-b}')
  else
    prev="—"
  fi

  local trpc_status="✅ resuelto"
  (( M_TRPC_IMPORT_OK == 0 )) && trpc_status="❌ roto — TS2305"
  local anyunjust=$(( M_ASANY - M_ASANY_JUSTIF )); (( anyunjust < 0 )) && anyunjust=0
  local missing_dr=$(( (M_SB_MODULES-M_SB_DR) + (M_EB_MODULES-M_EB_DR) ))

  write_file ".claude/AUDIT-LAST.md" <<MD
# AUDIT-LAST.md — Auditoría de welver/

**Fecha:** $(date +%F)
**Generado por:** \`./x.sh docs\` — mediciones sobre el árbol de trabajo
**Protocolo:** \`.claude/AUDIT.md\`

> Este archivo **no se escribe a mano**. Cada score sale de un conteo sobre el
> repo, con la rúbrica aplicada en \`compute_scores()\` dentro de \`x.sh\`.
> Para regenerarlo: \`./x.sh docs\`. Para ver los checks sin escribir: \`./x.sh status\`.
>
> Lo que un ADR declara implementado **no cuenta como evidencia**. Sólo el conteo.

---

## Scores por dimensión

| # | Dimensión | Score | Peso | Pond. | Medición |
|---|---|---|---|---|---|
| 1 | TypeScript Strict | ${S1}/10 | 15% | $(awk -v s=$S1 'BEGIN{printf "%.2f", s*0.15}') | \`noImplicitAny:false\` en algún back: $(( M_NOIMPLICITANY ? 1 : 0 )) · \`any\` sin justificar: ${anyunjust} (de ${M_ASANY} totales, ${M_ASANY_JUSTIF} con \`@real/jsonb-cast\`) · archivos con class-validator: ${M_CLASSVAL} |
| 2 | Arquitectura de capas | ${S2}/10 | 20% | $(awk -v s=$S2 'BEGIN{printf "%.2f", s*0.20}') | sass-back ${M_SB_DR}/${M_SB_MODULES} módulos con \`domain/\`+\`repository/\` · ecommerce-back ${M_EB_DR}/${M_EB_MODULES} · services con \`PrismaService\` inyectado: ${M_PRISMA_IN_SVC} · \`AnyRouter\`/\`any\` en packages/trpc: ${M_ANYROUTER} |
| 3 | Frontend — Fetch y estado | ${S3}/10 | 15% | $(awk -v s=$S3 'BEGIN{printf "%.2f", s*0.15}') | archivos con \`HydrationBoundary\`: ${M_HYDRATION} (sobre ${M_STORE_PAGES} \`page.tsx\` en storefront) · \`fetch()\` crudo en hooks: ${M_RAWFETCH} · import \`@real/trpc\`: ${trpc_status} |
| 4 | Seguridad | ${S4}/10 | 15% | $(awk -v s=$S4 'BEGIN{printf "%.2f", s*0.15}') | helmet ${M_HELMET}/2 · \`@Throttle\` en auth: ${M_THROTTLE} · \`migrate deploy\` ${M_MIGRATE}/2 · CORS wildcard: ${M_CORS_WILDCARD} · \`.dockerignore\` ${M_DOCKERIGNORE}/5 · \`\$queryRaw\`: ${M_RAWQUERY} ⚠️ auditar interpolación · \`pnpm audit\` en CI: ${M_WF_AUDIT} |
| 5 | Configuración y entorno | ${S5}/10 | 10% | $(awk -v s=$S5 'BEGIN{printf "%.2f", s*0.10}') | \`.env.example\` backs ${M_ENVEXAMPLE}/2 (fronts ${M_ENVEXAMPLE_FRONT}/3, informativo) · fail-fast en main.ts ${M_ENVGUARD}/2 · \`packageManager\`: ${M_PKGMGR} · named catalogs: ${M_NAMEDCAT} · conflicto nixpacks/railway: ${M_NIXPACKS_CONFLICT} · \`railway.json\` ${M_RAILWAY_JSON}/5 · versiones de pnpm distintas: ${M_PNPM_VERSIONS} |
| 6 | CI/CD y tests | ${S6}/10 | 10% | $(awk -v s=$S6 'BEGIN{printf "%.2f", s*0.10}') | workflows: ${M_WORKFLOWS} (con typecheck ${M_WF_TYPECHECK}, con path filters ${M_WF_PATHS}, que corren tests ${M_WF_TESTS}) · tests backend ${M_SPEC_BACK} · frontend ${M_SPEC_FRONT} · e2e ${M_SPEC_E2E} · unidades testeables ${M_TESTABLE} · \`coverageThreshold\`: ${M_COV_THRESHOLD} |
| 7 | Deuda técnica | ${S7}/10 | 15% | $(awk -v s=$S7 'BEGIN{printf "%.2f", s*0.15}') | módulos sin D+R: ${missing_dr} · imports legacy: ${M_LEGACY} · archivos con observabilidad: ${M_OTEL} · TODO/FIXME/HACK: ${M_TODO} · \`.bak-*\` sin limpiar: ${M_BAK} |

## Score global: **${GLOBAL}/10**

Anterior: ${prev} · Delta: ${delta}

---

## Cómo leer un delta

Un delta negativo puede significar dos cosas distintas y conviene no confundirlas:

1. **Regresión real** — entró código que empeoró una dimensión.
2. **Corrección de medición** — antes se puntuaba sobre lo declarado en un ADR y
   ahora se cuenta sobre archivos. El 9.01 del 2026-09-08 convivía con
   \`noImplicitAny:false\` en el tsconfig de ecommerce-back: ese score medía intención.

Desde que este archivo lo genera \`x.sh\`, los deltas sólo pueden ser del tipo 1.

---

## Gaps abiertos, ordenados por impacto en el global

$( (( M_NOIMPLICITANY )) && cat <<'G1'
### `noImplicitAny: false` en ecommerce-back
`realsass-ecommerce-back/tsconfig.json` extiende `tsconfig.base.json` (strict:true)
y después lo desarma. Mientras esté, ningún `any` implícito de ese servicio falla
el typecheck — el score de D1 mide un techo, no el piso real.
**Cerralo primero:** define cuánto trabajo hay debajo. `./x.sh ecommerce-back`
**Riesgo:** puede destapar decenas de errores. Correr typecheck antes de commitear.
G1
)
$( (( M_TRPC_IMPORT_OK == 0 )) && cat <<'G2'
### Import roto de `@real/trpc`
`realsass-sass-front/lib/config-client.ts` importa `AppRouter`; el paquete sólo
exporta `SassAppRouter` y `EcommerceAppRouter`. Es TS2305 — ese front no compila.
`./x.sh packages && ./x.sh sass-front`
G2
)
$( (( M_HYDRATION == 0 )) && cat <<'G3'
### HydrationBoundary en cero
Ningún archivo del storefront usa `dehydrate` + `<HydrationBoundary>`. Los Server
Components hacen prefetch y el cliente vuelve a pedir: loading flash en SSR real.
No lo aplica `x.sh` — requiere `prefetchQuery` página por página. Task E11-02.
G3
)
$( (( missing_dr > 0 )) && printf '### %s módulos sin Domain/Repository\nLos services van directo a Prisma. Marcado como decisión consciente en E1-12..E1-15;\nsigue siendo defendible hasta que entre pagos-back.\n' "$missing_dr" )
$( (( M_OTEL == 0 )) && printf '### Observabilidad en cero\n0 archivos con `opentelemetry`, `prom-client` o `correlationId`. Escalón 6 completo\nsin empezar. Sin `correlationId` propagado, un incidente que cruza los dos backs\nno se puede reconstruir.\n' )
$( (( M_RAWQUERY > 0 )) && printf '### %s usos de `\$queryRaw`/`\$executeRaw`\nNo verificable por conteo: hay que leer cada uno y confirmar que no interpola\ninput del usuario. Task E7-03.\n' "$M_RAWQUERY" )

---

## Lo que este script **no** puede medir

| Ítem | Por qué | Cómo cerrarlo |
|---|---|---|
| \`organizationId\` en cada \`where\` | requiere análisis semántico, no grep | test cross-tenant (E8-05) |
| N+1 / \`include\` explícito | idem | \`EXPLAIN ANALYZE\` (E11-04) |
| Interpolación en \`\$queryRaw\` | grep detecta el uso, no el riesgo | revisión manual de los ${M_RAWQUERY} usos |
| Calidad de los tests existentes | cuenta archivos, no asserts | \`coverageThreshold\` en jest.config |
| Prefijo \`organizationId\` en claves Redis | depende del cuerpo de cada llamada | E10-01 |

La única forma de cerrar la primera fila es un test, no una auditoría. Sigue siendo
el trabajo de mayor valor pendiente: un \`findMany\` sin \`organizationId\` es fuga de
datos entre organizaciones y hoy nada lo detecta.
MD

  write_file ".claude/CONTEXT.md" <<MD
# CONTEXT.md — Estado de la sesión activa

**Repo:** grupojl/welver
**Score actual:** ${GLOBAL}/10 — medido el $(date +%F) por \`./x.sh docs\`
**Anterior:** ${prev} (delta ${delta})

---

## Sesión activa

**Objetivo de esta sesión:**
_(actualizar al empezar)_

**Bloqueante actual:**
$( (( M_TRPC_IMPORT_OK == 0 )) && echo "\`realsass-sass-front/lib/config-client.ts\` importa \`AppRouter\`, símbolo que \`@real/trpc\` no exporta (TS2305). Ese front no compila." || echo "Ninguno detectado por medición automática." )

**Última decisión tomada:**
El score lo calcula \`x.sh docs\` midiendo el repo. Un ADR marcado ✅ Implementado
no es evidencia — sólo el conteo lo es.

**Próximo paso concreto:**
$( (( M_NOIMPLICITANY )) && echo "\`./x.sh ecommerce-back --dry-run\`, revisar el diff, después typecheck del servicio." || echo "Ver los gaps abiertos en AUDIT-LAST.md." )

---

## Estado por dimensión

| Dimensión | Score |
|---|---|
| TypeScript Strict | ${S1} |
| Arquitectura de capas | ${S2} |
| Frontend | ${S3} |
| Seguridad | ${S4} |
| Config/entorno | ${S5} |
| CI/CD y tests | ${S6} |
| Deuda técnica | ${S7} |

---

## Cómo cerrar una sesión

1. Actualizar las 4 líneas de "Sesión activa" arriba.
2. Correr \`./x.sh docs\` — regenera este archivo y \`AUDIT-LAST.md\` con el score real.
3. Agregar las decisiones del día a \`DECISIONS-LOG.md\`.

---

## Historial de sesiones

| Fecha | Objetivo | Score al cerrar |
|-------|----------|-----------------|
| 2026-09-08 | Setup del sistema de auditoría | 9.01 (declarado) |
| $(date +%F) | Auditoría por medición automática | ${GLOBAL} (medido) |
MD

  sync_tasks
  commit_scope "docs" "docs(.claude): auditoría medida — score ${GLOBAL}/10 (${delta})"
}

# ==============================================================================
# Dispatcher
# ==============================================================================
usage() { sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

main() {
  while (( $# )); do
    case "$1" in
      --dry-run)   DRY_RUN=1 ;;
      --no-backup) BACKUP=0 ;;
      --force)     FORCE=1 ;;
      --commit)    DO_COMMIT=1 ;;
      -h|--help)   usage; exit 0 ;;
      -*)          die "flag desconocido: $1" ;;
      *)           TARGET="$1" ;;
    esac
    shift
  done

  [[ -n "$TARGET" ]] || { usage; exit 1; }
  [[ -f "$ROOT/pnpm-workspace.yaml" ]] || die "x.sh debe ejecutarse desde la raíz del monorepo."

  (( DRY_RUN )) && warn "DRY-RUN — no se escribe nada."

  case "$TARGET" in
    status)          run_status ;;
    clean)           apply_clean ;;
    root)            apply_root ;;
    packages)        apply_packages ;;
    sass-back)       apply_sass_back ;;
    ecommerce-back)  apply_ecommerce_back ;;
    sass-front)      apply_sass_front ;;
    dashboard-front) apply_dashboard_front ;;
    ecommerce-front) apply_ecommerce_front ;;
    docs)            apply_docs ;;
    all)
      warn "'all' toca los 5 servicios → 5 deploys simultáneos en Railway."
      warn "Preferí un target por vez. Continuando en 3s… (Ctrl-C para abortar)"
      sleep 3
      apply_root; apply_packages; apply_sass_back; apply_ecommerce_back
      apply_sass_front; apply_dashboard_front; apply_ecommerce_front; apply_docs
      ;;
    *) die "target desconocido: $TARGET" ;;
  esac

  head1 "resumen"
  if (( ${#CHANGED_FILES[@]} )); then
    log "  Archivos tocados (${#CHANGED_FILES[@]}):"
    printf '    %s\n' "${CHANGED_FILES[@]}"
  else
    log "  Sin cambios en disco."
  fi
  (( ${#SKIPPED[@]} )) && log "  ${c_dim}Omitidos por idempotencia: ${#SKIPPED[@]}${c_off}"

  if [[ "$TARGET" != "status" && "$TARGET" != "docs" ]] && (( ${#CHANGED_FILES[@]} )); then
    log ""
    warn "Antes de pushear:  pnpm --filter <servicio> typecheck && pnpm --filter <servicio> build"
  fi
}

main "$@"