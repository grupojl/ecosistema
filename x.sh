#!/usr/bin/env bash
# x.sh — Agrega NEXT_PUBLIC_SASS_FRONT_URL al Dockerfile del dashboard-front
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${YELLOW}▶${NC} $1"; }
ok()  { echo -e "${GREEN}✓${NC} $1"; }

TARGET="realsass-dashboard-front/Dockerfile"
[ -f "$TARGET" ] || { echo "No se encontró $TARGET"; exit 1; }

log "Agregando ARG/ENV NEXT_PUBLIC_SASS_FRONT_URL al Dockerfile..."

# Agregar ARG después de la última ARG NEXT_PUBLIC existente
sed -i 's/ARG NEXT_PUBLIC_STORE_FRONT_URL/ARG NEXT_PUBLIC_STORE_FRONT_URL\nARG NEXT_PUBLIC_SASS_FRONT_URL\nARG NEXT_PUBLIC_SASS_BACK_URL/' "$TARGET"

# Agregar ENV después del último ENV NEXT_PUBLIC existente  
sed -i 's/ENV NEXT_PUBLIC_STORE_FRONT_URL=$NEXT_PUBLIC_STORE_FRONT_URL/ENV NEXT_PUBLIC_STORE_FRONT_URL=$NEXT_PUBLIC_STORE_FRONT_URL\nENV NEXT_PUBLIC_SASS_FRONT_URL=$NEXT_PUBLIC_SASS_FRONT_URL\nENV NEXT_PUBLIC_SASS_BACK_URL=$NEXT_PUBLIC_SASS_BACK_URL/' "$TARGET"

ok "Dockerfile actualizado"

# Verificar que quedó bien
echo ""
echo "  Líneas agregadas:"
grep -n "SASS_FRONT\|SASS_BACK" "$TARGET"
echo ""