#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix Dockerfiles + Vercel Analytics en fronts
#
# Servicios afectados: realsass-sass-front, realsass-dashboard-front
#
# Problemas resueltos:
#   1. realsass-sass-front/Dockerfile     — runner stage con node_modules raíz
#   2. realsass-dashboard-front/Dockerfile — ídem + runner stage faltaba completamente
#   3. realsass-dashboard-front/app/layout.tsx — saca <Analytics /> de Vercel
#      (corre en Railway, no en Vercel — genera 404 en cada carga)
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
log()  { echo -e "[→] $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

# =============================================================================
# 1. realsass-sass-front/Dockerfile
# =============================================================================
log "Reescribiendo realsass-sass-front/Dockerfile ..."

cat > "realsass-sass-front/Dockerfile" << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/ui/package.json          ./packages/ui/
COPY packages/trpc/package.json        ./packages/trpc/
COPY realsass-sass-front/package.json  ./realsass-sass-front/
RUN echo "shamefully-hoist=true" >> .npmrc
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SASS_BACK_URL
ARG NEXT_PUBLIC_DASHBOARD_FRONT_URL
ARG NEXT_PUBLIC_DASHBOARD_API_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SASS_BACK_URL=$NEXT_PUBLIC_SASS_BACK_URL
ENV NEXT_PUBLIC_DASHBOARD_FRONT_URL=$NEXT_PUBLIC_DASHBOARD_FRONT_URL
ENV NEXT_PUBLIC_DASHBOARD_API_URL=$NEXT_PUBLIC_DASHBOARD_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules    ./node_modules
COPY tsconfig.base.json               ./tsconfig.base.json
COPY package.json pnpm-workspace.yaml ./
COPY packages/                        ./packages/
COPY realsass-sass-front/             ./realsass-sass-front/
WORKDIR /app/realsass-sass-front
RUN /app/node_modules/.bin/next build

FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# shamefully-hoist pone todo en la raíz — copiamos node_modules del builder
COPY --from=builder --chown=nextjs:nodejs /app/node_modules              ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json              ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages                  ./packages
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/.next ./realsass-sass-front/.next
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/public ./realsass-sass-front/public
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/package.json ./realsass-sass-front/package.json
USER nextjs
EXPOSE 3000
WORKDIR /app/realsass-sass-front
CMD ["../node_modules/.bin/next", "start"]
EOF

ok "realsass-sass-front/Dockerfile actualizado"

# =============================================================================
# 2. realsass-dashboard-front/Dockerfile
# =============================================================================
log "Reescribiendo realsass-dashboard-front/Dockerfile ..."

cat > "realsass-dashboard-front/Dockerfile" << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/ui/package.json          ./packages/ui/
COPY packages/trpc/package.json        ./packages/trpc/
COPY realsass-dashboard-front/package.json ./realsass-dashboard-front/
RUN echo "shamefully-hoist=true" >> .npmrc
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_REAL_BACK_URL
ARG NEXT_PUBLIC_ECOMMERCE_API_URL
ARG NEXT_PUBLIC_STORE_FRONT_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_REAL_BACK_URL=$NEXT_PUBLIC_REAL_BACK_URL
ENV NEXT_PUBLIC_ECOMMERCE_API_URL=$NEXT_PUBLIC_ECOMMERCE_API_URL
ENV NEXT_PUBLIC_STORE_FRONT_URL=$NEXT_PUBLIC_STORE_FRONT_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./tsconfig.base.json
COPY package.json pnpm-workspace.yaml   ./
COPY packages/                          ./packages/
COPY realsass-dashboard-front/          ./realsass-dashboard-front/
WORKDIR /app/realsass-dashboard-front
RUN /app/node_modules/.bin/next build

FROM node:22-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=nextjs:nodejs /app/node_modules                   ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json                   ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages                       ./packages
COPY --from=builder --chown=nextjs:nodejs /app/realsass-dashboard-front/.next ./realsass-dashboard-front/.next
COPY --from=builder --chown=nextjs:nodejs /app/realsass-dashboard-front/public ./realsass-dashboard-front/public
COPY --from=builder --chown=nextjs:nodejs /app/realsass-dashboard-front/package.json ./realsass-dashboard-front/package.json
USER nextjs
EXPOSE 3000
WORKDIR /app/realsass-dashboard-front
CMD ["../node_modules/.bin/next", "start"]
EOF

ok "realsass-dashboard-front/Dockerfile actualizado"

# =============================================================================
# 3. Sacar @vercel/analytics del layout del dashboard-front
#    Corre en Railway — el script de Vercel da 404 en cada carga de página
# =============================================================================
LAYOUT="realsass-dashboard-front/app/layout.tsx"
log "Eliminando Vercel Analytics de $LAYOUT ..."

# Eliminar import
sed -i "s|import { Analytics } from '@vercel/analytics/next'||g" "$LAYOUT"

# Eliminar el componente <Analytics />
sed -i "s|        <Analytics />||g" "$LAYOUT"

# Limpiar líneas vacías dobles que queden
# (no crítico pero mantiene el archivo limpio)

ok "$LAYOUT actualizado — Analytics de Vercel eliminado"

# =============================================================================
# 4. Sacar @vercel/analytics del layout del sass-front si existe
# =============================================================================
SASS_LAYOUT="realsass-sass-front/app/layout.tsx"
if grep -q "vercel/analytics" "$SASS_LAYOUT" 2>/dev/null; then
  log "Eliminando Vercel Analytics de $SASS_LAYOUT ..."
  sed -i "s|import { Analytics } from '@vercel/analytics/next'||g" "$SASS_LAYOUT"
  sed -i "s|import { Analytics } from '@vercel/analytics/react'||g" "$SASS_LAYOUT"
  sed -i "s|        <Analytics />||g" "$SASS_LAYOUT"
  sed -i "s|    <Analytics />||g" "$SASS_LAYOUT"
  ok "$SASS_LAYOUT actualizado"
else
  warn "$SASS_LAYOUT — no tiene Vercel Analytics, nada que hacer"
fi

echo ""
echo "============================================================"
echo "  Resumen de cambios"
echo "============================================================"
echo "  realsass-sass-front/Dockerfile"
echo "    → runner: node_modules desde raíz del builder"
echo "    → CMD: next start (sin standalone)"
echo ""
echo "  realsass-dashboard-front/Dockerfile"
echo "    → runner stage completo (antes estaba truncado)"
echo "    → node_modules desde raíz del builder"
echo "    → CMD: next start (sin standalone)"
echo ""
echo "  realsass-dashboard-front/app/layout.tsx"
echo "    → <Analytics /> de Vercel eliminado"
echo ""
echo "  Variables pendientes de agregar en Railway:"
echo "  → realsass-dashboard-front:"
echo "      NEXT_PUBLIC_FIREBASE_API_KEY"
echo "      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
echo "      NEXT_PUBLIC_FIREBASE_PROJECT_ID=real-sass"
echo "      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
echo "      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
echo "      NEXT_PUBLIC_FIREBASE_APP_ID"
echo "      NEXT_PUBLIC_REAL_BACK_URL=https://org-back.up.railway.app/api/v1"
echo "      NEXT_PUBLIC_STORE_FRONT_URL=https://ecommerce-front.up.railway.app"
echo ""
echo "  → realsass-sass-front:"
echo "      NEXT_PUBLIC_FIREBASE_PROJECT_ID=real-sass  (corregir, era el appId)"
echo "      NEXT_PUBLIC_FIREBASE_APP_ID=1:386632850263:web:67c7a6d2213fed25cefc12"
echo "      NEXT_PUBLIC_API_URL=https://org-back.up.railway.app/api/v1"
echo "      NEXT_PUBLIC_DASHBOARD_FRONT_URL=https://dashboard-front.up.railway.app"
echo "      NEXT_PUBLIC_SASS_BACK_URL=https://org-back.up.railway.app"
echo "============================================================"
ok "Listo. make g → Railway redeploya ambos servicios."