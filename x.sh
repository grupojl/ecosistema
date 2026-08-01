#!/usr/bin/env bash
# fix-monorepo-dockerfiles.sh
# Ejecutar desde la RAÍZ del monorepo (welver/)
# Reescribe Dockerfiles para build context = raíz monorepo
# Actualiza railway.json de cada servicio con dockerfilePath correcto

set -euo pipefail

echo "═══════════════════════════════════════════════════════"
echo " fix-monorepo-dockerfiles.sh — build context = raíz"
echo "═══════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────
# 1. realsass-sass-back — Dockerfile
# ─────────────────────────────────────────────────────────
echo "[1/5] Reescribiendo realsass-sass-back/Dockerfile..."
cat > realsass-sass-back/Dockerfile << 'DOCKERFILE'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

# ── Stage 1: deps ─────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app

# Archivos de workspace y lock — necesarios para resolver el catalog
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Solo los package.json de los workspaces que necesita este servicio
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/ui/package.json          ./packages/ui/
COPY packages/trpc/package.json        ./packages/trpc/
COPY realsass-sass-back/package.json   ./realsass-sass-back/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: builder ──────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app

ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=development

COPY --from=deps /app/node_modules         ./node_modules
COPY --from=deps /app/packages             ./packages
COPY package.json pnpm-workspace.yaml ./
COPY realsass-sass-back/                   ./realsass-sass-back/
COPY packages/                             ./packages/

WORKDIR /app/realsass-sass-back
RUN pnpm prisma generate && pnpm run build
RUN test -f dist/src/main.js || (echo "ERROR: dist/src/main.js no generado" && exit 1)

# ── Stage 3: runner ───────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/realsass-sass-back/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/realsass-sass-back/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/realsass-sass-back/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/realsass-sass-back/package.json ./package.json
USER nestjs
EXPOSE 3000
CMD ["dumb-init", "node", "dist/src/main"]
DOCKERFILE

# ─────────────────────────────────────────────────────────
# 2. realsass-ecommerce-back — Dockerfile
# ─────────────────────────────────────────────────────────
echo "[2/5] Reescribiendo realsass-ecommerce-back/Dockerfile..."
cat > realsass-ecommerce-back/Dockerfile << 'DOCKERFILE'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

# ── Stage 1: deps ─────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json    ./packages/auth-client/
COPY packages/ui/package.json             ./packages/ui/
COPY packages/trpc/package.json           ./packages/trpc/
COPY realsass-ecommerce-back/package.json ./realsass-ecommerce-back/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: builder ──────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app

ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=development

COPY --from=deps /app/node_modules            ./node_modules
COPY package.json pnpm-workspace.yaml ./
COPY realsass-ecommerce-back/                 ./realsass-ecommerce-back/
COPY packages/                                ./packages/

WORKDIR /app/realsass-ecommerce-back
RUN pnpm prisma generate && pnpm run build
RUN test -f dist/src/main.js || (echo "ERROR: dist/src/main.js no generado" && exit 1)

# ── Stage 3: runner ───────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/realsass-ecommerce-back/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/realsass-ecommerce-back/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/realsass-ecommerce-back/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/realsass-ecommerce-back/package.json ./package.json
USER nestjs
EXPOSE 3000
CMD ["dumb-init", "node", "dist/src/main"]
DOCKERFILE

# ─────────────────────────────────────────────────────────
# 3. realsass-dashboard-front — Dockerfile
# ─────────────────────────────────────────────────────────
echo "[3/5] Reescribiendo realsass-dashboard-front/Dockerfile..."
cat > realsass-dashboard-front/Dockerfile << 'DOCKERFILE'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

# ── Stage 1: deps ─────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json       ./packages/auth-client/
COPY packages/ui/package.json                ./packages/ui/
COPY packages/trpc/package.json              ./packages/trpc/
COPY realsass-dashboard-front/package.json   ./realsass-dashboard-front/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: builder ──────────────────────────────────────
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

COPY --from=deps /app/node_modules              ./node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/                                  ./packages/
COPY realsass-dashboard-front/                  ./realsass-dashboard-front/

WORKDIR /app/realsass-dashboard-front
RUN pnpm run build

# ── Stage 3: runner ───────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/realsass-dashboard-front/public                ./public
COPY --from=builder --chown=nextjs:nodejs /app/realsass-dashboard-front/.next/standalone      ./
COPY --from=builder --chown=nextjs:nodejs /app/realsass-dashboard-front/.next/static          ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
DOCKERFILE

# ─────────────────────────────────────────────────────────
# 4. realsass-sass-front — Dockerfile
# ─────────────────────────────────────────────────────────
echo "[4/5] Reescribiendo realsass-sass-front/Dockerfile..."
cat > realsass-sass-front/Dockerfile << 'DOCKERFILE'
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

# ── Stage 1: deps ─────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json    ./packages/auth-client/
COPY packages/ui/package.json             ./packages/ui/
COPY packages/trpc/package.json           ./packages/trpc/
COPY realsass-sass-front/package.json     ./realsass-sass-front/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: builder ──────────────────────────────────────
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
ARG NEXT_PUBLIC_DASHBOARD_API_URL
ARG NEXT_PUBLIC_DASHBOARD_FRONT_URL
ARG NEXT_PUBLIC_CONFIG_API_URL

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DASHBOARD_API_URL=$NEXT_PUBLIC_DASHBOARD_API_URL
ENV NEXT_PUBLIC_DASHBOARD_FRONT_URL=$NEXT_PUBLIC_DASHBOARD_FRONT_URL
ENV NEXT_PUBLIC_CONFIG_API_URL=$NEXT_PUBLIC_CONFIG_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules          ./node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/                              ./packages/
COPY realsass-sass-front/                   ./realsass-sass-front/

WORKDIR /app/realsass-sass-front
RUN pnpm run build

# ── Stage 3: runner ───────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/public                ./public
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/.next/standalone      ./
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/.next/static          ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
DOCKERFILE

# ─────────────────────────────────────────────────────────
# 5. Actualizar railway.json de cada servicio
#    dockerfilePath apunta desde la raíz del monorepo
# ─────────────────────────────────────────────────────────
echo "[5/5] Actualizando railway.json de cada servicio..."

cat > realsass-sass-back/railway.json << 'JSON'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "realsass-sass-back/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
JSON

cat > realsass-ecommerce-back/railway.json << 'JSON'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "realsass-ecommerce-back/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
JSON

cat > realsass-dashboard-front/railway.json << 'JSON'
{
  "$schema": "https://railway.app/railway.schema.json",
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

cat > realsass-sass-front/railway.json << 'JSON'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "realsass-sass-front/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
JSON

echo ""
echo "═══════════════════════════════════════════════════════"
echo " ✓ Listo"
echo "═══════════════════════════════════════════════════════"
echo ""
echo " PASO CRÍTICO EN RAILWAY:"
echo " Para cada servicio, ir a Settings → Source → Root Directory"
echo " y dejarlo en BLANCO (raíz del monorepo)."
echo ""
echo " Si estaba seteado a 'realsass-sass-back/', cambiarlo a ''."
echo " Esto es lo que permite que el build context sea el monorepo completo."
echo ""
echo " Archivos modificados:"
echo "   realsass-sass-back/Dockerfile"
echo "   realsass-sass-back/railway.json"
echo "   realsass-ecommerce-back/Dockerfile"
echo "   realsass-ecommerce-back/railway.json"
echo "   realsass-dashboard-front/Dockerfile"
echo "   realsass-dashboard-front/railway.json"
echo "   realsass-sass-front/Dockerfile"
echo "   realsass-sass-front/railway.json"