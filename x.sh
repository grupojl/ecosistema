#!/usr/bin/env bash
# x-catalog.sh — Lleva 4 paquetes hardcodeados al catalog (welver/ecosistema)
# Resuelve F1:
#   - @nestjs-modules/ioredis ^3.0.0  → realsass-ecommerce-back/package.json
#   - next-themes ^0.4.6              → realsass-sass-front/package.json
#   - postcss ^8.5.28                 → realsass-sass-front/package.json (devDeps)
#   - tw-animate-css ^1.4.0           → realsass-sass-front/package.json (devDeps)
# Sin Python — solo bash + awk
# Uso: bash x-catalog.sh  (desde la raíz del monorepo)
set -euo pipefail

OK()   { echo "  ✅ $1"; }
SKIP() { echo "  ⏭️  $1"; }
WARN() { echo "  ⚠️  $1"; }
ERR()  { echo "  ❌ $1"; exit 1; }

echo "=== x-catalog.sh — Catalog F1 (4 paquetes) ==="
echo ""

WORKSPACE="pnpm-workspace.yaml"
[[ -f "$WORKSPACE" ]] || ERR "No se encuentra $WORKSPACE — ejecutar desde la raíz del monorepo"

# =============================================================================
# Paso 1: agregar las 4 entradas al catalog en pnpm-workspace.yaml
# Insertar después de la última entrada del bloque catalog: (antes del cierre)
# =============================================================================
echo "── Paso 1: pnpm-workspace.yaml ──────────────────────────────────────────"

add_to_catalog() {
  local PACKAGE="$1"
  local VERSION="$2"

  if grep -q "\"$PACKAGE\"" "$WORKSPACE" 2>/dev/null; then
    SKIP "catalog ya tiene $PACKAGE"
    return
  fi

  # Insertar antes de la línea "packages:" o antes de una línea vacía al final del catalog
  # Busca la última línea del bloque catalog (línea con "  ") y agrega después
  awk -v pkg="$PACKAGE" -v ver="$VERSION" '
    /^packages:/ && !inserted {
      print "    \"" pkg "\": \"" ver "\""
      inserted = 1
    }
    { print }
  ' "$WORKSPACE" > "${WORKSPACE}.tmp" && mv "${WORKSPACE}.tmp" "$WORKSPACE"

  grep -q "\"$PACKAGE\"" "$WORKSPACE" \
    && OK "catalog: \"$PACKAGE\": \"$VERSION\" agregado" \
    || WARN "no se pudo agregar $PACKAGE al catalog — agregar manualmente"
}

add_to_catalog "@nestjs-modules/ioredis" "^3.0.0"
add_to_catalog "next-themes"             "^0.4.6"
add_to_catalog "postcss"                 "^8.5.28"
add_to_catalog "tw-animate-css"          "^1.4.0"

echo ""

# =============================================================================
# Paso 2: reemplazar versiones hardcodeadas por catalog: en los package.json
# =============================================================================
echo "── Paso 2: reemplazar versiones hardcodeadas por catalog: ───────────────"

replace_with_catalog() {
  local FILE="$1"
  local PACKAGE="$2"

  [[ ! -f "$FILE" ]] && { WARN "$FILE no encontrado"; return; }

  # Verificar si ya usa catalog:
  if grep -q "\"$PACKAGE\": \"catalog:" "$FILE" 2>/dev/null; then
    SKIP "$PACKAGE ya usa catalog: en $FILE"
    return
  fi

  # Reemplazar la línea con versión hardcodeada por catalog:
  awk -v pkg="$PACKAGE" '
    $0 ~ ("\"" pkg "\"\\s*:\\s*\"[^c]") {
      # Extraer indentación
      match($0, /^[[:space:]]*/)
      indent = substr($0, 1, RLENGTH)
      print indent "\"" pkg "\": \"catalog:\","
      next
    }
    { print }
  ' "$FILE" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"

  grep -q "\"$PACKAGE\": \"catalog:" "$FILE" \
    && OK "$FILE: $PACKAGE → catalog:" \
    || WARN "$FILE: no se pudo reemplazar $PACKAGE — verificar manualmente"
}

# ecommerce-back: @nestjs-modules/ioredis
replace_with_catalog "realsass-ecommerce-back/package.json" "@nestjs-modules/ioredis"

# sass-front: next-themes (dependencies)
replace_with_catalog "realsass-sass-front/package.json" "next-themes"

# sass-front: postcss (devDependencies)
replace_with_catalog "realsass-sass-front/package.json" "postcss"

# sass-front: tw-animate-css (devDependencies)
replace_with_catalog "realsass-sass-front/package.json" "tw-animate-css"

echo ""
echo "────────────────────────────────────────────────────────────────────────"
echo "  Listo."
echo ""
echo "  PASO MANUAL REQUERIDO:"
echo "    pnpm install"
echo "    (actualiza pnpm-lock.yaml con las nuevas entradas del catalog)"
echo ""
echo "  Luego verificar:"
echo "    bash audit-f.sh  → F1 debe pasar ✅"
echo "────────────────────────────────────────────────────────────────────────"