#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix Dockerfile runner stage realsass-sass-front
#
# Problema: output: 'standalone' genera server.js en .next/standalone/
#           El COPY lo copia a /app/ pero el CMD buscaba en
#           /app/realsass-sass-front/server.js — ruta incorrecta.
#
# Con standalone el árbol copiado queda:
#   /app/server.js          ← entry point
#   /app/node_modules/      ← deps mínimas generadas por Next
#   /app/.next/static/      ← assets estáticos
#   /app/public/            ← archivos públicos
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
log() { echo -e "[→] $1"; }

DOCKERFILE="realsass-sass-front/Dockerfile"
log "Reescribiendo $DOCKERFILE ..."

cat > "$DOCKERFILE" << 'EOF'
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

# standalone genera su propio árbol con node_modules mínimas y server.js en la raíz
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/.next/standalone ./
# assets estáticos van a la ruta que Next espera dentro del standalone
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/public           ./public

USER nextjs
EXPOSE 3000
# server.js queda en /app/server.js después del COPY standalone
CMD ["node", "server.js"]
EOF

ok "$DOCKERFILE actualizado"

echo ""
echo "============================================================"
echo "  Estructura del runner con output: standalone"
echo "============================================================"
echo "  /app/server.js          <- entry point (CMD apunta aca)"
echo "  /app/node_modules/      <- deps minimas generadas por Next"
echo "  /app/.next/static/      <- assets estaticos"
echo "  /app/public/            <- archivos publicos"
echo "============================================================"
ok "Listo. Commitea y Railway redeploya."