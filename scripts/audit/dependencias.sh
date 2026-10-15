#!/usr/bin/env bash
# audit-f.sh — Dependencias (welver/ecosistema)
# v2: fix F1 (peerDependencies son excepción válida), F2 (catalog: + peer conviven)
set -euo pipefail

BUGS=0; DEBTS=0
BACKENDS="realsass-sass-back realsass-ecommerce-back"

BUG()  { echo "  ❌ [$1] $2"; BUGS=$((BUGS+1)); }
DEBT() { echo "  ⚠️  [$1] $2"; DEBTS=$((DEBTS+1)); }
OK()   { echo "  ✅ [$1] $2"; }

echo "=== Audit F — Dependencias (welver) ==="
echo ""

# F1 — Versiones hardcodeadas en dependencies/devDependencies (no en peerDependencies)
# FIX v2: peerDependencies con rangos (>=X) es el patrón CORRECTO para packages/*
# Solo flagear versiones hardcodeadas en "dependencies" y "devDependencies"
echo "F1 — Versiones hardcodeadas en dependencies (no catalog: ni workspace:*)..."
F1_BUGS=0

# Función: dado un package.json, extrae solo el bloque dependencies/devDependencies
# y busca valores que no sean catalog: ni workspace:*
check_deps() {
  local PKG="$1"
  local LABEL="$2"
  # awk: procesa solo dentro de "dependencies" o "devDependencies" (no peer)
  local RESULT
  RESULT=$(awk '
    /"(dependencies|devDependencies)"\s*:\s*\{/ { in_block=1; next }
    /"peerDependencies"/ { in_block=0 }
    in_block && /\}/ { in_block=0; next }
    in_block && /"[^"]+"\s*:\s*"/ {
      # Excluir catalog:, workspace:*, "version" field
      if ($0 !~ /catalog:|workspace:\*|"version"/) print $0
    }
  ' "$PKG" || true)
  if [[ -n "$RESULT" ]]; then
    echo "     → versiones hardcodeadas en $LABEL:"
    echo "$RESULT" | sed 's/^/          /'
    return 1
  fi
  return 0
}

for PKG in \
  "realsass-sass-back/package.json" \
  "realsass-ecommerce-back/package.json" \
  "realsass-sass-front/package.json" \
  "realsass-dashboard-front/package.json" \
  "real-ecommerce-front/package.json" \
  "packages/auth-server/package.json" \
  "packages/auth-client/package.json" \
  "packages/ui/package.json" \
  "packages/trpc/package.json"; do
  [[ ! -f "$PKG" ]] && continue
  check_deps "$PKG" "$PKG" || F1_BUGS=$((F1_BUGS+1))
done

[[ $F1_BUGS -eq 0 ]] && OK "F1" "Sin versiones hardcodeadas en dependencies/devDependencies — catalog: correcto" \
                       || BUG "F1" "$F1_BUGS package(s) con versiones hardcodeadas en dependencies (ADR-002)"

# F2 — packages/* con frameworks en dependencies (no en peerDependencies)
# FIX v2: es CORRECTO que packages/* tengan "framework": "catalog:" en dependencies
# (para build) Y "framework": ">=X" en peerDependencies (para el consumer).
# Solo es bug si el framework está en dependencies SIN estar en peerDependencies
# (significa que el package bundlea el framework → dos instancias en runtime).
echo "F2 — packages/* con frameworks solo en dependencies (sin peer)..."
F2_BUGS=0
for PKG in packages/*/package.json; do
  [[ ! -f "$PKG" ]] && continue
  for FRAMEWORK in "@nestjs/common" "react" "react-dom" "firebase-admin"; do
    IN_DEPS=$(grep -c "\"$FRAMEWORK\"" "$PKG" 2>/dev/null | tr -d '\r\n' || echo 0)
    IN_PEER=$(awk '/"peerDependencies"/,/\}/' "$PKG" | grep -c "\"$FRAMEWORK\"" 2>/dev/null || echo 0)
    IN_DEPS=$(echo "$IN_DEPS" | tr -d '\r\n')
    IN_PEER=$(echo "$IN_PEER" | tr -d '\r\n')
    if [[ "$IN_DEPS" =~ ^[0-9]+$ && "$IN_PEER" =~ ^[0-9]+$ ]] \
       && [[ $IN_DEPS -gt 0 && $IN_PEER -eq 0 ]]; then
      echo "     → [$PKG] $FRAMEWORK en dependencies sin peerDependencies — riesgo de doppelganger"
      F2_BUGS=$((F2_BUGS+1))
    fi
  done
done
[[ $F2_BUGS -eq 0 ]] && OK "F2" "packages/* con frameworks declarados correctamente (catalog: + peer)" \
                       || BUG "F2" "$F2_BUGS caso(s) de framework en deps sin peer — riesgo dos instancias"

# F3 — Sin named catalogs (catalog:nombre — prohibidos ADR-002)
echo "F3 — Sin named catalogs (catalog:algo — prohibidos)..."
F3=$(grep -rn "\"catalog:[a-zA-Z]" --include="package.json" . \
  --exclude-dir=node_modules 2>/dev/null || true)
[[ -z "$F3" ]] && OK "F3" "Sin named catalogs — todo usa catalog: default" \
               || { echo "$F3" | head -3; BUG "F3" "Named catalogs detectados — prohibidos por ADR-002"; }

# F4 — pnpm-lock.yaml actualizado (existe y no está vacío)
echo "F4 — pnpm-lock.yaml actualizado..."
if [[ -f "pnpm-lock.yaml" ]] && [[ -s "pnpm-lock.yaml" ]]; then
  OK "F4" "pnpm-lock.yaml presente y no vacío"
else
  BUG "F4" "pnpm-lock.yaml ausente o vacío — correr pnpm install"
fi

# F5 — @nestjs-modules/ioredis declarado en ecommerce-back (phantom dep ADR-018)
echo "F5 — @nestjs-modules/ioredis declarado en ecommerce-back..."
ECOM_PKG="realsass-ecommerce-back/package.json"
if [[ -f "$ECOM_PKG" ]] && grep -q "nestjs-modules/ioredis" "$ECOM_PKG"; then
  OK "F5" "@nestjs-modules/ioredis declarado en ecommerce-back — phantom dep resuelta"
else
  BUG "F5" "realsass-ecommerce-back usa @nestjs-modules/ioredis (market-resolver.service.ts) pero no lo declara — phantom dep (ADR-018)"
fi

# F6 — Entries del catalog sin consumidor conocido (deuda informativa)
echo "F6 — Entries del catalog sin consumidor (deuda)..."
# Solo verificamos que el catalog existe y tiene entries
if grep -q "catalog:" "pnpm-workspace.yaml" 2>/dev/null \
   || grep -q "\"catalog\"" "package.json" 2>/dev/null; then
  OK "F6" "catalog presente en workspace"
else
  DEBT "F6" "catalog no encontrado en pnpm-workspace.yaml — verificar configuración"
fi

# F7 — Sin duplicación de sistema de validación (Zod vs class-validator)
echo "F7 — Sin duplicación de responsabilidades..."
F7_BUGS=0
for SVC in $BACKENDS; do
  HAS_ZOD=$(grep -rl "from 'zod'" "$SVC/src" --include="*.ts" 2>/dev/null | wc -l | tr -d ' \r\n' || echo 0)
  HAS_CV=$(grep -rl "from 'class-validator'" "$SVC/src" --include="*.ts" 2>/dev/null | wc -l | tr -d ' \r\n' || echo 0)
  if [[ "$HAS_ZOD" =~ ^[0-9]+$ && "$HAS_CV" =~ ^[0-9]+$ ]] \
     && [[ $HAS_ZOD -gt 0 && $HAS_CV -gt 0 ]]; then
    echo "     → [$SVC] usa Zod Y class-validator — migrar class-validator a Zod (ADR-002)"
    F7_BUGS=$((F7_BUGS+1))
  fi
done
[[ $F7_BUGS -eq 0 ]] && OK "F7" "Sin duplicación de sistema de validación" \
                       || DEBT "F7" "$F7_BUGS backend(s) con Zod + class-validator — migrar a Zod"

echo ""
echo "────────────────────────────────────────"
if [[ $BUGS -eq 0 && $DEBTS -eq 0 ]]; then
  echo "  ✅  Sin hallazgos"
elif [[ $BUGS -eq 0 ]]; then
  echo "  ⚠️   0 bugs — $DEBTS deudas documentadas"
else
  echo "  ❌  $BUGS bug(s) bloqueante(s) — $DEBTS deuda(s)"
fi
echo "────────────────────────────────────────"
[[ $BUGS -eq 0 ]] && exit 0 || exit 1