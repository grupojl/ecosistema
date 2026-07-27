# syntax=docker/dockerfile:1.7
# =============================================================================
# realsass-ecommerce-back — Monorepo build
# =============================================================================

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml .npmrc ./
COPY packages/ ./packages/
COPY realsass-sass-back/package.json      ./realsass-sass-back/
COPY realsass-ecommerce-back/package.json ./realsass-ecommerce-back/
COPY realsass-sass-front/package.json     ./realsass-sass-front/
COPY realsass-dashboard-front/package.json ./realsass-dashboard-front/
COPY real-ecommerce-front/package.json    ./real-ecommerce-front/

RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=development

COPY --from=deps /app/node_modules         ./node_modules
COPY --from=deps /app/packages             ./packages
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY realsass-ecommerce-back/              ./realsass-ecommerce-back/

WORKDIR /app/realsass-ecommerce-back
RUN pnpm exec prisma generate
RUN pnpm run build
RUN test -f dist/src/main.js || test -f dist/main.js || (echo "ERROR: build no generado" && exit 1)

FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/realsass-ecommerce-back/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules                         ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/realsass-ecommerce-back/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/realsass-ecommerce-back/package.json ./package.json

USER nestjs
EXPOSE 3001
CMD ["dumb-init", "node", "dist/src/main"]
