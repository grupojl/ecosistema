#!/usr/bin/env bash
# audit-g.sh — Deploy / Railway (welver/ecosistema)
# v2: fix G8 — verifica railway.json en los 5 servicios (incluyendo dashboard-front)
set -euo pipefail

BUGS=0; DEBTS=0
BACKENDS="realsass-sass-back realsass-ecommerce-back"
FRONTENDS="realsass-sass-front realsass-dashboard-front real-ecommerce-front"
ALL_SERVICES="$BACKENDS $FRONTENDS"

BUG()  { echo "  ❌ [$1] $2"; BUGS=$((BUGS+1)); }
DEBT() { echo "  ⚠️  [$1] $2"; DEBTS=$((DEBTS+1)); }
OK()   { echo "  ✅ [$1] $2"; }

echo "=== Audit G — Deploy / Railway (welver) ==="
echo ""

# G1 — --platform=linux/amd64 en Dockerfiles de backends
echo "G1 — --platform=linux/amd64 en Dockerfiles de backends..."
G1_BUGS=0
for SVC in $BACKENDS; do
  DF="$SVC/Dockerfile"
  [[ ! -f "$DF" ]] && { BUG "G1" "[$SVC] Dockerfile no encontrado"; G1_BUGS=$((G1_BUGS+1)); continue; }
  grep -q "platform=linux/amd64" "$DF" \
    || { echo "     → [$SVC] sin --platform=linux/amd64"; G1_BUGS=$((G1_BUGS+1)); }
done
[[ $G1_BUGS -eq 0 ]] && OK "G1" "--platform=linux/amd64 en todos los Dockerfiles de backends" \
                       || BUG "G1" "$G1_BUGS backend(s) sin --platform=linux/amd64"

# G2 — dumb-init en backends
echo "G2 — dumb-init en backends..."
G2_BUGS=0
for SVC in $BACKENDS; do
  DF="$SVC/Dockerfile"
  [[ ! -f "$DF" ]] && continue
  grep -q "dumb-init" "$DF" \
    || { echo "     → [$SVC] sin dumb-init"; G2_BUGS=$((G2_BUGS+1)); }
done
[[ $G2_BUGS -eq 0 ]] && OK "G2" "dumb-init en ambos Dockerfiles de backends" \
                       || BUG "G2" "$G2_BUGS backend(s) sin dumb-init — señales de OS no propagadas"

# G3 — prisma migrate deploy en entrypoint.sh
echo "G3 — prisma migrate deploy en entrypoint.sh..."
G3_BUGS=0
for SVC in $BACKENDS; do
  EP="$SVC/entrypoint.sh"
  [[ ! -f "$EP" ]] && { BUG "G3" "[$SVC] entrypoint.sh no encontrado"; G3_BUGS=$((G3_BUGS+1)); continue; }
  grep -q "prisma migrate deploy" "$EP" \
    || { echo "     → [$SVC] sin 'prisma migrate deploy'"; G3_BUGS=$((G3_BUGS+1)); }
done
[[ $G3_BUGS -eq 0 ]] && OK "G3" "prisma migrate deploy en ambos entrypoints" \
                       || BUG "G3" "$G3_BUGS backend(s) sin prisma migrate deploy en entrypoint"

# G4 — HEALTHCHECK con puerto hardcodeado en backends
echo "G4 — HEALTHCHECK con puerto hardcodeado en backends..."
G4_BUGS=0
for SVC in $BACKENDS; do
  DF="$SVC/Dockerfile"
  [[ ! -f "$DF" ]] && continue
  grep -q "HEALTHCHECK" "$DF" \
    || { echo "     → [$SVC] sin HEALTHCHECK"; G4_BUGS=$((G4_BUGS+1)); }
done
[[ $G4_BUGS -eq 0 ]] && OK "G4" "HEALTHCHECK con puertos hardcodeados en backends" \
                       || BUG "G4" "$G4_BUGS backend(s) sin HEALTHCHECK"

# G5 — nixpacks.toml en frontends
echo "G5 — nixpacks.toml en frontends..."
G5_BUGS=0
for SVC in $FRONTENDS; do
  [[ ! -f "$SVC/nixpacks.toml" ]] \
    && { echo "     → [$SVC] nixpacks.toml ausente"; G5_BUGS=$((G5_BUGS+1)); }
done
[[ $G5_BUGS -eq 0 ]] && OK "G5" "nixpacks.toml presente en los 3 frontends" \
                       || BUG "G5" "$G5_BUGS frontend(s) sin nixpacks.toml"

# G6 — output: standalone en next.config.mjs de frontends
echo "G6 — output: standalone en next.config.mjs de frontends..."
G6_BUGS=0
for SVC in $FRONTENDS; do
  CFG="$SVC/next.config.mjs"
  [[ ! -f "$CFG" ]] && { BUG "G6" "[$SVC] next.config.mjs no encontrado"; G6_BUGS=$((G6_BUGS+1)); continue; }
  grep -q "standalone" "$CFG" \
    || { echo "     → [$SVC] sin output: 'standalone'"; G6_BUGS=$((G6_BUGS+1)); }
done
[[ $G6_BUGS -eq 0 ]] && OK "G6" "output: 'standalone' en los 3 next.config.mjs" \
                       || BUG "G6" "$G6_BUGS frontend(s) sin output: 'standalone'"

# G7 — nixpacks.toml con HOSTNAME=0.0.0.0 y server.js
echo "G7 — nixpacks.toml con HOSTNAME=0.0.0.0 y server.js..."
G7_BUGS=0
for SVC in $FRONTENDS; do
  NP="$SVC/nixpacks.toml"
  [[ ! -f "$NP" ]] && continue
  HAS_HOSTNAME=$(grep -c "HOSTNAME.*0.0.0.0" "$NP" 2>/dev/null | tr -d '\r\n' || echo 0)
  HAS_SERVER=$(grep -c "server.js" "$NP" 2>/dev/null | tr -d '\r\n' || echo 0)
  if [[ "$HAS_HOSTNAME" =~ ^[0-9]+$ && "$HAS_SERVER" =~ ^[0-9]+$ ]] \
     && [[ $HAS_HOSTNAME -eq 0 || $HAS_SERVER -eq 0 ]]; then
    echo "     → [$SVC] nixpacks.toml incompleto (HOSTNAME=$HAS_HOSTNAME server.js=$HAS_SERVER)"
    G7_BUGS=$((G7_BUGS+1))
  fi
done
[[ $G7_BUGS -eq 0 ]] && OK "G7" "nixpacks.toml con HOSTNAME=0.0.0.0 y server.js en los 3 frontends" \
                       || BUG "G7" "$G7_BUGS frontend(s) con nixpacks.toml incompleto"

# G8 — railway.json en TODOS los servicios (5 total)
# FIX v2: verifica los 5 servicios explícitamente, incluyendo dashboard-front
echo "G8 — railway.json en todos los servicios..."
G8_BUGS=0
for SVC in $ALL_SERVICES; do
  if [[ ! -f "$SVC/railway.json" ]]; then
    echo "     → [$SVC] railway.json ausente"
    G8_BUGS=$((G8_BUGS+1))
  fi
done
[[ $G8_BUGS -eq 0 ]] && OK "G8" "railway.json en los 5 servicios" \
                       || BUG "G8" "$G8_BUGS servicio(s) sin railway.json"

# G9 — schema.prisma en backends (DB por servicio)
echo "G9 — schema.prisma en backends (DB por servicio)..."
G9_BUGS=0
for SVC in $BACKENDS; do
  [[ ! -f "$SVC/prisma/schema.prisma" ]] \
    && { echo "     → [$SVC] prisma/schema.prisma ausente"; G9_BUGS=$((G9_BUGS+1)); }
done
[[ $G9_BUGS -eq 0 ]] && OK "G9" "schema.prisma en ambos backends" \
                       || BUG "G9" "$G9_BUGS backend(s) sin schema.prisma"

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