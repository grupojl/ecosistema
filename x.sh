#!/usr/bin/env bash
# =============================================================================
# 19_replace_imports.sh
# Reemplaza TODOS los imports/exports relativos (./ y ../) por alias @/
# en archivos .ts y .tsx de cada monorepo.
#
# USO:
#   cd /path/to/repo && bash 19_replace_imports.sh ecosistema-ms
#   cd /path/to/repo && bash 19_replace_imports.sh ecosistema
#   cd /path/to/repo && bash 19_replace_imports.sh superadmin
# =============================================================================
set -euo pipefail

REPO="${1:-}"
if [[ -z "$REPO" ]]; then
  echo "USO: bash 19_replace_imports.sh [ecosistema-ms|ecosistema|superadmin]"
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  replace imports @/ — ${REPO}"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# str_replace_line  LINE  OLD_PATH  NEW_PATH
# Reemplaza el string literal OLD_PATH por NEW_PATH en LINE,
# tanto con comillas simples como dobles. Sin regex — literal puro.
# ─────────────────────────────────────────────────────────────────────────────
str_replace_line() {
  local line="$1" old="$2" new="$3"
  echo "$line" | awk -v sq="'" -v old="${old}" -v new="${new}" '
    function srepl(str, from, to,    r, i, n) {
      r = ""; n = length(from)
      while ((i = index(str, from)) > 0) {
        r = r substr(str, 1, i-1) to
        str = substr(str, i+n)
      }
      return r str
    }
    {
      line = srepl($0,  sq old sq,   sq new sq)
      line = srepl(line, "\"" old "\"", "\"" new "\"")
      print line
    }'
}

# ─────────────────────────────────────────────────────────────────────────────
# replace_dir  SEARCH_DIR  ALIAS_ROOT  [EXTRA_SED]
#
# SEARCH_DIR  — directorio donde buscar archivos .ts/.tsx
# ALIAS_ROOT  — raíz que corresponde a @/
#               backend  → SERVICE/src   (so @/ = src/)
#               frontend → FRONT_DIR     (so @/ = raíz del front)
#
# Algoritmo por archivo:
#   1. Para cada línea con import/export ... from './X' o '../X':
#   2. Extraer el path relativo
#   3. Usar realpath -m para resolver desde ALIAS_ROOT
#   4. Si el resultado no sale de ALIAS_ROOT → reemplazar con @/resultado
# ─────────────────────────────────────────────────────────────────────────────
replace_dir() {
  local search_dir="$1"
  local alias_root="$2"
  local extra_sed="${3:-}"

  if [[ ! -d "$search_dir" ]]; then
    echo "  ⚠  SKIP: $search_dir no existe"
    return
  fi

  local changed=0 total=0
  local tmp_base="/tmp/ri_${$}"

  while IFS= read -r -d '' abs_file; do
    total=$((total + 1))
    local before
    before=$(md5sum "$abs_file" | cut -d' ' -f1)

    # Caso especial antes del reemplazo genérico
    if [[ -n "$extra_sed" ]]; then
      eval "sed -i \"$extra_sed\" \"$abs_file\""
    fi

    # Directorio del archivo relativo a alias_root
    local rel_file="${abs_file#${alias_root}/}"
    local file_dir
    file_dir=$(dirname "$rel_file")

    # Preparar directorio tmp para realpath
    mkdir -p "${tmp_base}/${file_dir}"

    local tmp_file="${abs_file}.ri_tmp"

    while IFS= read -r line; do
      if echo "$line" | grep -qE "from ['\"]\.\.?/"; then
        local import_path
        import_path=$(echo "$line" | grep -oP "(?<=from ['\"])[^'\"]*" \
                      | grep -E "^\.\.?/" | head -1 || true)

        if [[ -n "$import_path" ]]; then
          local resolved
          resolved=$(cd "${tmp_base}/${file_dir}" && \
            realpath -m --relative-to="${tmp_base}" "${import_path}" 2>/dev/null || echo "")

          if [[ -n "$resolved" ]] && ! echo "$resolved" | grep -qE "^\.\.|^/"; then
            line=$(str_replace_line "$line" "$import_path" "@/${resolved}")
          fi
        fi
      fi
      printf '%s\n' "$line"
    done < "$abs_file" > "$tmp_file"

    mv "$tmp_file" "$abs_file"

    local after
    after=$(md5sum "$abs_file" | cut -d' ' -f1)
    if [[ "$before" != "$after" ]]; then
      changed=$((changed + 1))
      echo "  ✔  $abs_file"
    fi
  done < <(find "$search_dir" -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/node_modules/*" ! -path "*/.next/*" ! -path "*/dist/*" -print0)

  rm -rf "$tmp_base"
  echo "  → ${search_dir}: ${changed}/${total} archivos modificados"
}

# ─────────────────────────────────────────────────────────────────────────────
# Ejecución por repo
# ─────────────────────────────────────────────────────────────────────────────
case "$REPO" in

  ecosistema-ms)
    for svc in analytics-backend chatia-backend notificaciones-backend pasarelapagos-backend workers-backend; do
      echo "▶  ${svc}..."
      replace_dir "${svc}/src" "${svc}/src"
    done
    echo ""
    for pkg in packages/auth-server packages/grpc-client packages/logger packages/metrics packages/proto; do
      [[ -d "${pkg}/src" ]] || continue
      echo "▶  ${pkg}..."
      replace_dir "${pkg}/src" "${pkg}/src"
    done
    ;;

  ecosistema)
    for svc in realsass-ecommerce-back realsass-sass-back; do
      echo "▶  ${svc}..."
      replace_dir "${svc}/src" "${svc}/src"
    done
    echo ""
    for pkg in packages/auth-server packages/trpc; do
      [[ -d "${pkg}/src" ]] || continue
      echo "▶  ${pkg}..."
      replace_dir "${pkg}/src" "${pkg}/src"
    done
    echo ""
    for front in real-ecommerce-front realsass-dashboard-front realsass-sass-front; do
      echo "▶  ${front}..."
      replace_dir "$front" "$front"
    done
    ;;

  superadmin)
    EXTRA="s|from '\.\./\.\./shared-types'|from '@grupojl/shared-types'|g; s|from \"\.\./\.\./shared-types\"|from \"@grupojl/shared-types\"|g"
    echo "▶  grupojl-control-backend..."
    replace_dir "grupojl-control-backend/src" "grupojl-control-backend/src" "$EXTRA"
    echo ""
    echo "▶  grupojl-control-frontend..."
    replace_dir "grupojl-control-frontend" "grupojl-control-frontend"
    ;;

  *)
    echo "❌  Repo desconocido: $REPO"
    exit 1
    ;;
esac

# ─────────────────────────────────────────────────────────────────────────────
# Estado final — grep de verificación
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "✅  replace imports — ${REPO} completado"
echo ""
echo "── Estado final (grep) ─────────────────────────────────────"
echo ""

case "$REPO" in
  ecosistema-ms) DIRS="analytics-backend/src chatia-backend/src notificaciones-backend/src pasarelapagos-backend/src workers-backend/src" ;;
  ecosistema)    DIRS="realsass-ecommerce-back/src realsass-sass-back/src real-ecommerce-front realsass-dashboard-front realsass-sass-front" ;;
  superadmin)    DIRS="grupojl-control-backend/src grupojl-control-frontend" ;;
esac

echo "Imports/exports relativos restantes (./ y ../):"
REMAINING=$(grep -rE "from ['\"]\.\.?/" $DIRS \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
  2>/dev/null | wc -l || true)
echo "  Total líneas: ${REMAINING}"

if [[ "$REMAINING" -gt 0 ]]; then
  echo ""
  echo "  Archivos con relativos restantes:"
  grep -rlE "from ['\"]\.\.?/" $DIRS \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
    2>/dev/null | sort | head -20 || true
  echo ""
  echo "  Primeras 20 líneas restantes:"
  grep -rE "from ['\"]\.\.?/" $DIRS \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
    2>/dev/null | head -20 || true
fi

echo ""
echo "Imports @/ propios nuevos:"
ALIAS_COUNT=$(grep -rE "from ['\"]@/" $DIRS \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
  2>/dev/null \
  | grep -vE "@nestjs|@prisma|@grpc|@opentelemetry|@willsoto|@types|@ecosistema|@real/|@grupojl|@tanstack|@trpc|@hookform|@radix|@vercel|@tailwind|@vitest|@testing|@playwright" \
  | wc -l || true)
echo "  Total: ${ALIAS_COUNT}"

echo "══════════════════════════════════════════════════════════════"