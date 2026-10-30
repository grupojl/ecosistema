# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo
# Railway  → Root Directory: /  |  Dockerfile Path: realsass-design-front/Dockerfile
#
# Sistema de diseño (taller de UI: la fuente de los componentes vive en ./ui y se migra a packages/ui). No usa tRPC: no necesita el stage `contracts` (ADR-019).
# Ref: .claude/architecture/06-dockerfile-frontend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY realsass-design-front/package.json ./realsass-design-front/

RUN echo "shamefully-hoist=true" >> .npmrc
RUN pnpm install --frozen-lockfile --filter realsass-design-front...

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY package.json pnpm-workspace.yaml   ./
COPY realsass-design-front/               ./realsass-design-front/

WORKDIR /app/realsass-design-front
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

COPY --from=build --chown=nextjs:nodejs /app/realsass-design-front/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/realsass-design-front/.next/static     ./realsass-design-front/.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/ || exit 1

WORKDIR /app/realsass-design-front
CMD ["node", "server.js"]
