# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo
# Railway  → Root Directory: /  |  Dockerfile Path: realsass-docs-front/Dockerfile
#
# Centro de ayuda para usuarios. Usa @real/ui (UI compartida) pero no tRPC: no necesita el stage `contracts` (ADR-019).
# Ref: .claude/architecture/06-dockerfile-frontend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/ui/package.json             ./packages/ui/
COPY realsass-docs-front/package.json ./realsass-docs-front/

RUN echo "shamefully-hoist=true" >> .npmrc
RUN pnpm install --frozen-lockfile --filter realsass-docs-front...

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY package.json pnpm-workspace.yaml   ./
COPY packages/ui/                       ./packages/ui/
COPY realsass-docs-front/               ./realsass-docs-front/

WORKDIR /app/realsass-docs-front
RUN /app/node_modules/.bin/next build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=nextjs:nodejs /app/realsass-docs-front/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/realsass-docs-front/.next/static     ./realsass-docs-front/.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/ || exit 1

WORKDIR /app/realsass-docs-front
CMD ["node", "server.js"]
