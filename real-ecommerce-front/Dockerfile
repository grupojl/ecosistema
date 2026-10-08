# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)
# Railway  → Root Directory: /  |  Dockerfile Path: real-ecommerce-front/Dockerfile
#
# Storefront público (SSG/ISR): tienda, catálogo, carrito, checkout, tracking
# PREREQUISITO: output: 'standalone' en next.config.mjs
# Ref: .claude/architecture/06-dockerfile-frontend.md

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps

# Un ARG declarado antes del primer FROM NO existe dentro de los stages: hay que re-declararlo.
# Sin esto ${PNPM_VERSION} queda vacío, corepack baja el pnpm más nuevo (pnpm@*) y se rompen el
# lockfile y las políticas de .npmrc (en pnpm 11+ ignore-scripts / shamefully-hoist no se leen de ahí).
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json    ./packages/auth-client/
COPY packages/ui/package.json             ./packages/ui/
COPY packages/trpc/package.json           ./packages/trpc/
COPY real-ecommerce-front/package.json    ./real-ecommerce-front/

RUN echo "shamefully-hoist=true" >> .npmrc

# Sin --mount=type=cache: Railway exige que el id lleve el prefijo s/<id-del-servicio>- y un Dockerfile
# no conoce ese id (error "missing the cacheKey prefix"). Sin cache, cada build reinstala las dependencias.
RUN pnpm install --frozen-lockfile

# ─── Stage 2: contracts (ADR-019) ─────────────────────────────────────────────
# @real/trpc emite los .d.ts de los routers de AMBOS backs a packages/trpc/dist.
# El front no lleva el código de los backs: este stage los usa solo para generar los
# tipos y se descarta; a la imagen del front únicamente llega packages/trpc/dist.
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS contracts

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-server/package.json     ./packages/auth-server/
COPY packages/trpc/package.json            ./packages/trpc/
COPY realsass-sass-back/package.json       ./realsass-sass-back/
COPY realsass-ecommerce-back/package.json  ./realsass-ecommerce-back/

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json                 ./
COPY packages/auth-server/              ./packages/auth-server/
COPY packages/trpc/                     ./packages/trpc/
COPY realsass-sass-back/                ./realsass-sass-back/
COPY realsass-ecommerce-back/           ./realsass-ecommerce-back/

# Los services tipan con el cliente Prisma generado de cada back
RUN pnpm --filter realsass-sass-back exec prisma generate \
 && pnpm --filter realsass-ecommerce-back exec prisma generate
RUN pnpm --filter @real/trpc build

# ─── Stage 3: build ───────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

ARG NEXT_PUBLIC_ECOMMERCE_API_URL
ARG NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID
ARG SITE_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

ENV NEXT_PUBLIC_ECOMMERCE_API_URL=$NEXT_PUBLIC_ECOMMERCE_API_URL
ENV NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID=$NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID
# SITE_URL es de runtime (robots.txt y sitemap la leen por request); se declara acá solo para
# que el build no registre "[seo] SITE_URL no configurado". Definirla también como variable de runtime.
ENV SITE_URL=$SITE_URL
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
COPY --from=contracts /app/packages/trpc/dist ./packages/trpc/dist
COPY real-ecommerce-front/              ./real-ecommerce-front/

WORKDIR /app/real-ecommerce-front
RUN /app/node_modules/.bin/next build

# ─── Stage 4: runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS runtime

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
