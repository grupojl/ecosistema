#!/usr/bin/env bash
# x.sh — Agrega variables faltantes en Dockerfiles de sass-front y dashboard-front
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${YELLOW}▶${NC} $1"; }
ok()  { echo -e "${GREEN}✓${NC} $1"; }

# ─── sass-front Dockerfile ───────────────────────────────────────────────────
# Falta: NEXT_PUBLIC_SASS_BACK_URL (usado en use-dashboard-sso.ts)
# Ya tiene: NEXT_PUBLIC_DASHBOARD_FRONT_URL

SASS_DF="realsass-sass-front/Dockerfile"
[ -f "$SASS_DF" ] || { echo "No se encontró $SASS_DF"; exit 1; }

log "Parcheando $SASS_DF..."

sed -i 's/ARG NEXT_PUBLIC_DASHBOARD_FRONT_URL/ARG NEXT_PUBLIC_DASHBOARD_FRONT_URL\nARG NEXT_PUBLIC_SASS_BACK_URL/' "$SASS_DF"
sed -i 's/ENV NEXT_PUBLIC_DASHBOARD_FRONT_URL=\$NEXT_PUBLIC_DASHBOARD_FRONT_URL/ENV NEXT_PUBLIC_DASHBOARD_FRONT_URL=$NEXT_PUBLIC_DASHBOARD_FRONT_URL\nENV NEXT_PUBLIC_SASS_BACK_URL=$NEXT_PUBLIC_SASS_BACK_URL/' "$SASS_DF"

ok "$SASS_DF listo"

# ─── dashboard-front Dockerfile ──────────────────────────────────────────────
# Falta: NEXT_PUBLIC_SASS_FRONT_URL y NEXT_PUBLIC_SASS_BACK_URL

DASH_DF="realsass-dashboard-front/Dockerfile"
[ -f "$DASH_DF" ] || { echo "No se encontró $DASH_DF"; exit 1; }

log "Parcheando $DASH_DF..."

sed -i 's/ARG NEXT_PUBLIC_STORE_FRONT_URL/ARG NEXT_PUBLIC_STORE_FRONT_URL\nARG NEXT_PUBLIC_SASS_FRONT_URL\nARG NEXT_PUBLIC_SASS_BACK_URL/' "$DASH_DF"
sed -i 's/ENV NEXT_PUBLIC_STORE_FRONT_URL=\$NEXT_PUBLIC_STORE_FRONT_URL/ENV NEXT_PUBLIC_STORE_FRONT_URL=$NEXT_PUBLIC_STORE_FRONT_URL\nENV NEXT_PUBLIC_SASS_FRONT_URL=$NEXT_PUBLIC_SASS_FRONT_URL\nENV NEXT_PUBLIC_SASS_BACK_URL=$NEXT_PUBLIC_SASS_BACK_URL/' "$DASH_DF"

ok "$DASH_DF listo"

echo ""
echo "  Variables agregadas:"
echo "  sass-front Dockerfile:      NEXT_PUBLIC_SASS_BACK_URL"
echo "  dashboard-front Dockerfile: NEXT_PUBLIC_SASS_FRONT_URL, NEXT_PUBLIC_SASS_BACK_URL"
echo ""
echo "  Variables requeridas en Railway:"
echo "  realsass-sass-front:"
echo "    NEXT_PUBLIC_SASS_BACK_URL=https://org-back.up.railway.app"
echo "    NEXT_PUBLIC_DASHBOARD_FRONT_URL=https://dashboard-front.up.railway.app"
echo "  realsass-dashboard-front:"
echo "    NEXT_PUBLIC_SASS_FRONT_URL=https://org-front.up.railway.app"
echo ""