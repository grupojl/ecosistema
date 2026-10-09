# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)
# Railway  → Root Directory: /  |  Dockerfile Path: realsass-ecommerce-back/Dockerfile
# VPS/AWS  → docker build -f realsass-ecommerce-back/Dockerfile .
#
# HTTP:  3001 (catálogo, stock, carrito, órdenes, clientes)
# tRPC:  EcommerceAppRouter — contrato tipado con los frontends
# Ref: .claude/architecture/05-dockerfile-backend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps

RUN apk add --no-cache dumb-init
# Un ARG declarado antes del primer FROM NO existe dentro de los stages: hay que re-declararlo.
# Sin esto ${PNPM_VERSION} queda vacío, corepack baja el pnpm más nuevo (pnpm@*) y se rompen el
# lockfile y las políticas de .npmrc (en pnpm 11+ ignore-scripts / shamefully-hoist no se leen de ahí).
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-server/package.json      ./packages/auth-server/
COPY packages/trpc/package.json             ./packages/trpc/
COPY realsass-ecommerce-back/package.json   ./realsass-ecommerce-back/

RUN echo "shamefully-hoist=true" >> .npmrc

# Sin --mount=type=cache: Railway exige que el id lleve el prefijo s/<id-del-servicio>- y un Dockerfile
# no conoce ese id (error "missing the cacheKey prefix"). Sin cache, cada build reinstala las dependencias.
RUN pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY packages/auth-server/              ./packages/auth-server/
COPY packages/trpc/                     ./packages/trpc/
COPY realsass-ecommerce-back/           ./realsass-ecommerce-back/
# node_modules por workspace (symlinks + .bin/prisma): sin esto `pnpm prisma` no se encuentra
COPY --from=deps /app/packages/auth-server/node_modules      ./packages/auth-server/node_modules
COPY --from=deps /app/packages/trpc/node_modules             ./packages/trpc/node_modules
COPY --from=deps /app/realsass-ecommerce-back/node_modules   ./realsass-ecommerce-back/node_modules

# @real/trpc/markets y @/server/context se leen de packages/trpc/dist (ADR-019). El back solo
# necesita el paso "core" (hoja sin ciclo, no depende de los backs); el build completo
# (contratos de ambos backs) es solo para los fronts.
WORKDIR /app/packages/trpc
RUN pnpm exec tsc -p tsconfig.core.json

WORKDIR /app/realsass-ecommerce-back

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS runtime

RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app/realsass-ecommerce-back

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build --chown=nestjs:nodejs /app/node_modules                            ../node_modules
COPY --from=build --chown=nestjs:nodejs /app/realsass-ecommerce-back/dist            ./dist
COPY --from=build --chown=nestjs:nodejs /app/realsass-ecommerce-back/prisma          ./prisma
COPY --from=build --chown=nestjs:nodejs /app/realsass-ecommerce-back/prisma.config.ts   ./prisma.config.ts
COPY --from=build --chown=nestjs:nodejs /app/realsass-ecommerce-back/package.json    ./package.json
COPY --chown=nestjs:nodejs realsass-ecommerce-back/entrypoint.sh                     ./entrypoint.sh

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# entrypoint.sh se invoca con sh: en git no tiene bit ejecutable (modo 100644)
CMD ["dumb-init", "sh", "/app/realsass-ecommerce-back/entrypoint.sh"]
