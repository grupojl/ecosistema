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
