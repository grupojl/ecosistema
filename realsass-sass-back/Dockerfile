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
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps

RUN apk add --no-cache dumb-init
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-server/package.json  ./packages/auth-server/
COPY realsass-sass-back/package.json    ./realsass-sass-back/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-sass-back,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY packages/auth-server/              ./packages/auth-server/
COPY realsass-sass-back/                ./realsass-sass-back/

WORKDIR /app/realsass-sass-back

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS runtime

RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app/realsass-sass-back

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=nestjs:nodejs /app/node_modules                         ../node_modules
COPY --from=build --chown=nestjs:nodejs /app/realsass-sass-back/dist              ./dist
COPY --from=build --chown=nestjs:nodejs /app/realsass-sass-back/prisma            ./prisma
COPY --from=build --chown=nestjs:nodejs /app/realsass-sass-back/package.json      ./package.json
COPY --chown=nestjs:nodejs realsass-sass-back/entrypoint.sh                       ./entrypoint.sh

USER nestjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["dumb-init", "/app/realsass-sass-back/entrypoint.sh"]
