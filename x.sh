#!/usr/bin/env bash
# x.sh — welver/ (ecosistema Real)
# Genera: Dockerfile + .dockerignore para los 2 backends y 3 frontends
#
# Uso:    bash x.sh          (desde la raíz del monorepo welver/)
# Make:   make x
#
# Archivos que genera:
#   realsass-sass-back/Dockerfile
#   realsass-sass-back/.dockerignore
#   realsass-sass-back/entrypoint.sh
#   realsass-ecommerce-back/Dockerfile
#   realsass-ecommerce-back/.dockerignore
#   realsass-ecommerce-back/entrypoint.sh
#   realsass-sass-front/Dockerfile
#   realsass-sass-front/.dockerignore
#   realsass-dashboard-front/Dockerfile
#   realsass-dashboard-front/.dockerignore
#   real-ecommerce-front/Dockerfile
#   real-ecommerce-front/.dockerignore
#
# Diferencias por servicio:
#   realsass-sass-back      → NestJS · HTTP 3000 · BullMQ (webhook-delivery) · entrypoint.sh
#   realsass-ecommerce-back → NestJS · HTTP 3001 · tRPC adapter · entrypoint.sh
#   realsass-sass-front     → Next.js · standalone · NEXT_PUBLIC_* (sass-back + dashboard-front)
#   realsass-dashboard-front → Next.js · standalone · NEXT_PUBLIC_* (sass-back + ecommerce-back + store)
#   real-ecommerce-front    → Next.js · standalone · NEXT_PUBLIC_* (ecommerce-back)
#
# Packages compartidos:
#   @real/auth-server → backends (compilado en dist/, NO se copia en runtime)
#   @real/auth-client → los 3 frontends (compilado en build, NO se copia en runtime)
#   @real/ui          → los 3 frontends
#   @real/trpc        → ecommerce-back + los 3 frontends
#
# Nota sobre entrypoint.sh:
#   Los backends usan entrypoint.sh para correr `prisma migrate deploy` antes de
#   arrancar. Esto garantiza que las migrations están aplicadas en cada deploy.
#   Las migrations NO van en la imagen — solo schema.prisma.
#
# Referencias:
#   .claude/architecture/05-dockerfile-backend.md
#   .claude/architecture/06-dockerfile-frontend.md
#   .claude/architecture/07-railway-deploy.md
#   .claude/roadmap/logros-adr010.md

set -euo pipefail

# ── colores ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✔${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✖${NC}  $*"; exit 1; }

# ── guardia: ejecutar desde la raíz del monorepo ─────────────────────────────
[[ -f "pnpm-workspace.yaml" ]]          || err "Ejecutar desde la raíz del monorepo welver/"
[[ -d "realsass-sass-back" ]]           || err "No se encontró realsass-sass-back/"
[[ -d "realsass-ecommerce-back" ]]      || err "No se encontró realsass-ecommerce-back/"
[[ -d "realsass-sass-front" ]]          || err "No se encontró realsass-sass-front/"
[[ -d "realsass-dashboard-front" ]]     || err "No se encontró realsass-dashboard-front/"
[[ -d "real-ecommerce-front" ]]         || err "No se encontró real-ecommerce-front/"
[[ -d "packages/auth-server" ]]         || err "No se encontró packages/auth-server/"
[[ -d "packages/auth-client" ]]         || err "No se encontró packages/auth-client/"
[[ -d "packages/ui" ]]                  || err "No se encontró packages/ui/"
[[ -d "packages/trpc" ]]                || err "No se encontró packages/trpc/"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  x.sh — welver/ Dockerfiles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── función auxiliar: .dockerignore backend ───────────────────────────────────
write_backend_dockerignore() {
  local SERVICE_DIR="$1"
  cat > "${SERVICE_DIR}/.dockerignore" << 'EOF'
node_modules
dist
coverage
.env
.env.*
*.log
*.tsbuildinfo
prisma/migrations
prisma/seed.ts
generated
EOF
  ok "${SERVICE_DIR}/.dockerignore"
}

# ── función auxiliar: .dockerignore frontend ──────────────────────────────────
write_frontend_dockerignore() {
  local SERVICE_DIR="$1"
  cat > "${SERVICE_DIR}/.dockerignore" << 'EOF'
node_modules
.next
coverage
.env
.env.*
*.log
*.tsbuildinfo
EOF
  ok "${SERVICE_DIR}/.dockerignore"
}

# ── función auxiliar: entrypoint.sh (migrate deploy + start) ─────────────────
write_entrypoint() {
  local SERVICE_DIR="$1"
  cat > "${SERVICE_DIR}/entrypoint.sh" << 'EOF'
#!/bin/sh
# entrypoint.sh — corre prisma migrate deploy antes de arrancar el servidor
# Se ejecuta con dumb-init para manejar señales correctamente en Docker
set -e

echo "[entrypoint] Corriendo prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Arrancando servidor..."
exec node dist/main.js
EOF
  chmod +x "${SERVICE_DIR}/entrypoint.sh"
  ok "${SERVICE_DIR}/entrypoint.sh"
}

# ══════════════════════════════════════════════════════════════════════════════
# 1. realsass-sass-back
#    NestJS · HTTP 3000
#    BullMQ: webhook-delivery
#    Packages: auth-server (compilado en dist — no se copia en runtime)
#    Extra: entrypoint.sh para prisma migrate deploy
#           crypto.service.ts (secrets cifrados — SECRET_ENCRYPTION_KEY requerida)
# ══════════════════════════════════════════════════════════════════════════════
cat > realsass-sass-back/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)
# Railway  → Root Directory: /  |  Dockerfile Path: realsass-sass-back/Dockerfile
# VPS/AWS  → docker build -f realsass-sass-back/Dockerfile .
#
# HTTP:  3000 (identidad, orgs, colaboradores, config, auditoría)
# BullMQ: webhook-delivery
# Auth: cookies HttpOnly (ADR-004) — SESSION_COOKIE_SECRET requerida
# Ref: .claude/architecture/05-dockerfile-backend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
# dumb-init para manejo correcto de señales en Docker (PID 1)
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-server/package.json  ./packages/auth-server/
COPY realsass-sass-back/package.json    ./realsass-sass-back/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-sass-back,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY packages/auth-server/              ./packages/auth-server/
COPY realsass-sass-back/                ./realsass-sass-back/

WORKDIR /app/realsass-sass-back

# prisma generate ANTES de nest build — genera query engine nativo (musl libc)
RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app/realsass-sass-back

ENV NODE_ENV=production
ENV PORT=3000

# @real/auth-server queda compilado dentro de dist/ — no se copia por separado
COPY --from=build --chown=nestjs:nodejs /app/node_modules                        ../node_modules
COPY --from=build --chown=nestjs:nodejs /app/realsass-sass-back/dist             ./dist
COPY --from=build --chown=nestjs:nodejs /app/realsass-sass-back/prisma           ./prisma
COPY --from=build --chown=nestjs:nodejs /app/realsass-sass-back/package.json     ./package.json
COPY --chown=nestjs:nodejs realsass-sass-back/entrypoint.sh                      ./entrypoint.sh

USER nestjs
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

# dumb-init maneja señales → prisma migrate deploy → node dist/main.js
CMD ["dumb-init", "/app/realsass-sass-back/entrypoint.sh"]
EOF
ok "realsass-sass-back/Dockerfile"
write_entrypoint "realsass-sass-back"
write_backend_dockerignore "realsass-sass-back"

# ══════════════════════════════════════════════════════════════════════════════
# 2. realsass-ecommerce-back
#    NestJS · HTTP 3001
#    tRPC adapter (EcommerceAppRouter)
#    Packages: auth-server, trpc (compilados en dist)
#    Extra: entrypoint.sh · organizations-client (HTTP a sass-back)
# ══════════════════════════════════════════════════════════════════════════════
cat > realsass-ecommerce-back/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)
# Railway  → Root Directory: /  |  Dockerfile Path: realsass-ecommerce-back/Dockerfile
# VPS/AWS  → docker build -f realsass-ecommerce-back/Dockerfile .
#
# HTTP:  3001 (catálogo, stock, carrito, órdenes, clientes)
# tRPC:  EcommerceAppRouter — contrato tipado con los frontends
# Inter-servicio: organizations-client → sass-back HTTP
# Ref: .claude/architecture/05-dockerfile-backend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-server/package.json      ./packages/auth-server/
COPY packages/trpc/package.json             ./packages/trpc/
COPY realsass-ecommerce-back/package.json   ./realsass-ecommerce-back/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-ecommerce-back,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY packages/auth-server/              ./packages/auth-server/
COPY packages/trpc/                     ./packages/trpc/
COPY realsass-ecommerce-back/           ./realsass-ecommerce-back/

WORKDIR /app/realsass-ecommerce-back

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app/realsass-ecommerce-back

ENV NODE_ENV=production
# Puerto 3001 — evita colisión con sass-back en el mismo host (VPS/local)
ENV PORT=3001

COPY --from=build --chown=nestjs:nodejs /app/node_modules                            ../node_modules
COPY --from=build --chown=nestjs:nodejs /app/realsass-ecommerce-back/dist            ./dist
COPY --from=build --chown=nestjs:nodejs /app/realsass-ecommerce-back/prisma          ./prisma
COPY --from=build --chown=nestjs:nodejs /app/realsass-ecommerce-back/package.json    ./package.json
COPY --chown=nestjs:nodejs realsass-ecommerce-back/entrypoint.sh                     ./entrypoint.sh

USER nestjs
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

CMD ["dumb-init", "/app/realsass-ecommerce-back/entrypoint.sh"]
EOF
ok "realsass-ecommerce-back/Dockerfile"
write_entrypoint "realsass-ecommerce-back"
write_backend_dockerignore "realsass-ecommerce-back"

# ══════════════════════════════════════════════════════════════════════════════
# 3. realsass-sass-front
#    Next.js · standalone · HTTP 3000
#    Dashboard de dueños (OWNER): landing + perfil + config de organización
#    Packages: auth-client, ui, trpc
#    NEXT_PUBLIC_*: sass-back URL + dashboard-front URL
# ══════════════════════════════════════════════════════════════════════════════
cat > realsass-sass-front/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)
# Railway  → Root Directory: /  |  Dockerfile Path: realsass-sass-front/Dockerfile
# VPS/AWS  → docker build -f realsass-sass-front/Dockerfile --build-arg ... .
#
# Dashboard de dueños (OWNER): landing pública + /profile + /settings
# PREREQUISITO: output: 'standalone' en next.config.mjs
# Ref: .claude/architecture/06-dockerfile-frontend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json    ./packages/auth-client/
COPY packages/ui/package.json             ./packages/ui/
COPY packages/trpc/package.json           ./packages/trpc/
COPY realsass-sass-front/package.json     ./realsass-sass-front/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-sass-front,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# NEXT_PUBLIC_* inlineadas en compile-time — no recuperables desde runtime ENV
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
# URL del backend de identidad (sass-back)
ARG NEXT_PUBLIC_SASS_BACK_URL
# URL del dashboard de colaboradores (para SSO redirect)
ARG NEXT_PUBLIC_DASHBOARD_FRONT_URL

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_SASS_BACK_URL=$NEXT_PUBLIC_SASS_BACK_URL
ENV NEXT_PUBLIC_DASHBOARD_FRONT_URL=$NEXT_PUBLIC_DASHBOARD_FRONT_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY package.json pnpm-workspace.yaml   ./
COPY packages/auth-client/              ./packages/auth-client/
COPY packages/ui/                       ./packages/ui/
COPY packages/trpc/                     ./packages/trpc/
COPY realsass-sass-front/               ./realsass-sass-front/

WORKDIR /app/realsass-sass-front
RUN /app/node_modules/.bin/next build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# CRÍTICO: Next.js standalone bindea a 127.0.0.1 — sin esto el healthcheck falla
ENV HOSTNAME=0.0.0.0

# standalone NO incluye .next/static/ ni public/ — copiar por separado
COPY --from=build --chown=nextjs:nodejs /app/realsass-sass-front/.next/standalone      ./
COPY --from=build --chown=nextjs:nodejs /app/realsass-sass-front/.next/static          ./realsass-sass-front/.next/static
COPY --from=build --chown=nextjs:nodejs /app/realsass-sass-front/public                ./realsass-sass-front/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

WORKDIR /app/realsass-sass-front
CMD ["node", "server.js"]
EOF
ok "realsass-sass-front/Dockerfile"
write_frontend_dockerignore "realsass-sass-front"

# Verificar output: standalone en next.config.mjs
SASS_FRONT_CONFIG="realsass-sass-front/next.config.mjs"
if grep -q "standalone" "$SASS_FRONT_CONFIG" 2>/dev/null; then
  ok "$SASS_FRONT_CONFIG — output: 'standalone' ya presente"
else
  warn "$SASS_FRONT_CONFIG — output: 'standalone' NO encontrado → agregar manualmente antes de buildear"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 4. realsass-dashboard-front
#    Next.js · standalone · HTTP 3000
#    Dashboard de colaboradores (COLLABORATOR): tienda, pedidos, chat IA, config
#    Packages: auth-client, ui, trpc
#    NEXT_PUBLIC_*: sass-back + ecommerce-back + store-front + chat-ia
# ══════════════════════════════════════════════════════════════════════════════
cat > realsass-dashboard-front/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)
# Railway  → Root Directory: /  |  Dockerfile Path: realsass-dashboard-front/Dockerfile
# VPS/AWS  → docker build -f realsass-dashboard-front/Dockerfile --build-arg ... .
#
# Dashboard de colaboradores (COLLABORATOR): /dashboard/tienda, /dashboard/chat, etc.
# PREREQUISITO: output: 'standalone' en next.config.mjs
# Ref: .claude/architecture/06-dockerfile-frontend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json        ./packages/auth-client/
COPY packages/ui/package.json                 ./packages/ui/
COPY packages/trpc/package.json               ./packages/trpc/
COPY realsass-dashboard-front/package.json    ./realsass-dashboard-front/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-dashboard-front,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
# URL del motor de identidad
ARG NEXT_PUBLIC_SASS_BACK_URL
# URL del motor de ecommerce (productos, pedidos)
ARG NEXT_PUBLIC_ECOMMERCE_API_URL
# URL de la tienda pública (preview de storefront)
ARG NEXT_PUBLIC_STORE_FRONT_URL
# URL del dashboard del dueño (sass-front — para links cruzados)
ARG NEXT_PUBLIC_SASS_FRONT_URL

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_SASS_BACK_URL=$NEXT_PUBLIC_SASS_BACK_URL
ENV NEXT_PUBLIC_ECOMMERCE_API_URL=$NEXT_PUBLIC_ECOMMERCE_API_URL
ENV NEXT_PUBLIC_STORE_FRONT_URL=$NEXT_PUBLIC_STORE_FRONT_URL
ENV NEXT_PUBLIC_SASS_FRONT_URL=$NEXT_PUBLIC_SASS_FRONT_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY package.json pnpm-workspace.yaml   ./
COPY packages/auth-client/              ./packages/auth-client/
COPY packages/ui/                       ./packages/ui/
COPY packages/trpc/                     ./packages/trpc/
COPY realsass-dashboard-front/          ./realsass-dashboard-front/

WORKDIR /app/realsass-dashboard-front
RUN /app/node_modules/.bin/next build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=nextjs:nodejs /app/realsass-dashboard-front/.next/standalone      ./
COPY --from=build --chown=nextjs:nodejs /app/realsass-dashboard-front/.next/static          ./realsass-dashboard-front/.next/static
COPY --from=build --chown=nextjs:nodejs /app/realsass-dashboard-front/public                ./realsass-dashboard-front/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

WORKDIR /app/realsass-dashboard-front
CMD ["node", "server.js"]
EOF
ok "realsass-dashboard-front/Dockerfile"
write_frontend_dockerignore "realsass-dashboard-front"

# Verificar output: standalone
DASH_FRONT_CONFIG="realsass-dashboard-front/next.config.mjs"
if grep -q "standalone" "$DASH_FRONT_CONFIG" 2>/dev/null; then
  ok "$DASH_FRONT_CONFIG — output: 'standalone' ya presente"
else
  warn "$DASH_FRONT_CONFIG — output: 'standalone' NO encontrado → agregar manualmente antes de buildear"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 5. real-ecommerce-front
#    Next.js · standalone · HTTP 3000
#    Storefront público (SSG/ISR) — clientes finales de cada organización
#    Packages: auth-client, ui, trpc
#    NEXT_PUBLIC_*: ecommerce-back URL
#    Nota: sin Firebase login — los clientes se identifican solo por email
# ══════════════════════════════════════════════════════════════════════════════
cat > real-ecommerce-front/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)
# Railway  → Root Directory: /  |  Dockerfile Path: real-ecommerce-front/Dockerfile
# VPS/AWS  → docker build -f real-ecommerce-front/Dockerfile --build-arg ... .
#
# Storefront público (SSG/ISR): tienda, catálogo, carrito, checkout, tracking
# Clientes finales — sin Firebase login (identificación por email en checkout)
# Multi-tenant: cada tienda se resuelve por slug → /tienda/[slug]
# PREREQUISITO: output: 'standalone' en next.config.mjs
# Ref: .claude/architecture/06-dockerfile-frontend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json    ./packages/auth-client/
COPY packages/ui/package.json             ./packages/ui/
COPY packages/trpc/package.json           ./packages/trpc/
COPY real-ecommerce-front/package.json    ./real-ecommerce-front/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-ecommerce-front,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# URL del motor de ecommerce — requerida para SSG y fetch server-side
ARG NEXT_PUBLIC_ECOMMERCE_API_URL
# Firebase solo para contexto de cliente (no login) — pueden ser vacíos
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

ENV NEXT_PUBLIC_ECOMMERCE_API_URL=$NEXT_PUBLIC_ECOMMERCE_API_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY package.json pnpm-workspace.yaml   ./
COPY packages/auth-client/              ./packages/auth-client/
COPY packages/ui/                       ./packages/ui/
COPY packages/trpc/                     ./packages/trpc/
COPY real-ecommerce-front/              ./real-ecommerce-front/

WORKDIR /app/real-ecommerce-front
RUN /app/node_modules/.bin/next build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=nextjs:nodejs /app/real-ecommerce-front/.next/standalone      ./
COPY --from=build --chown=nextjs:nodejs /app/real-ecommerce-front/.next/static          ./real-ecommerce-front/.next/static
COPY --from=build --chown=nextjs:nodejs /app/real-ecommerce-front/public                ./real-ecommerce-front/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

WORKDIR /app/real-ecommerce-front
CMD ["node", "server.js"]
EOF
ok "real-ecommerce-front/Dockerfile"
write_frontend_dockerignore "real-ecommerce-front"

# Verificar output: standalone
ECOMMERCE_FRONT_CONFIG="real-ecommerce-front/next.config.mjs"
if grep -q "standalone" "$ECOMMERCE_FRONT_CONFIG" 2>/dev/null; then
  ok "$ECOMMERCE_FRONT_CONFIG — output: 'standalone' ya presente"
else
  warn "$ECOMMERCE_FRONT_CONFIG — output: 'standalone' NO encontrado → agregar manualmente antes de buildear"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Resumen
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Archivos generados"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
printf "  %-30s %s\n" "Servicio"                    "Tipo      Puerto"
printf "  %-30s %s\n" "──────────────────────────────" "────────  ──────"
printf "  %-30s %s\n" "realsass-sass-back"           "NestJS    3000"
printf "  %-30s %s\n" "realsass-ecommerce-back"      "NestJS    3001"
printf "  %-30s %s\n" "realsass-sass-front"          "Next.js   3000"
printf "  %-30s %s\n" "realsass-dashboard-front"     "Next.js   3000"
printf "  %-30s %s\n" "real-ecommerce-front"         "Next.js   3000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Configuración Railway por servicio"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
for svc in realsass-sass-back realsass-ecommerce-back realsass-sass-front realsass-dashboard-front real-ecommerce-front; do
  echo "  ${svc}:"
  echo "    Root Directory:  /"
  echo "    Dockerfile Path: ${svc}/Dockerfile"
  echo "    Build Command:   (vacío)"
  echo "    Start Command:   (vacío)"
  echo ""
done
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Build args requeridos (Railway: configurar como Build Variables)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Todos los frontends necesitan:"
echo "    NEXT_PUBLIC_FIREBASE_API_KEY"
echo "    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
echo "    NEXT_PUBLIC_FIREBASE_PROJECT_ID"
echo "    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
echo "    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
echo "    NEXT_PUBLIC_FIREBASE_APP_ID"
echo ""
echo "  realsass-sass-front también:"
echo "    NEXT_PUBLIC_SASS_BACK_URL"
echo "    NEXT_PUBLIC_DASHBOARD_FRONT_URL"
echo ""
echo "  realsass-dashboard-front también:"
echo "    NEXT_PUBLIC_SASS_BACK_URL"
echo "    NEXT_PUBLIC_ECOMMERCE_API_URL"
echo "    NEXT_PUBLIC_STORE_FRONT_URL"
echo "    NEXT_PUBLIC_SASS_FRONT_URL"
echo ""
echo "  real-ecommerce-front también:"
echo "    NEXT_PUBLIC_ECOMMERCE_API_URL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
warn "Los 3 frontends necesitan output: 'standalone' en next.config.mjs"
warn "realsass-sass-back: configurar SECRET_ENCRYPTION_KEY en producción"
warn "realsass-ecommerce-back: configurar SASS_BACK_URL (para organizations-client)"
echo ""