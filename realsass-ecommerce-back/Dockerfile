# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json    ./packages/auth-client/
COPY packages/ui/package.json             ./packages/ui/
COPY packages/trpc/package.json           ./packages/trpc/
COPY realsass-ecommerce-back/package.json ./realsass-ecommerce-back/
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=development
COPY --from=deps /app/node_modules            ./node_modules
COPY --from=deps /app/packages                ./packages
COPY package.json pnpm-workspace.yaml         ./
COPY realsass-ecommerce-back/                 ./realsass-ecommerce-back/
COPY packages/                                ./packages/
RUN pnpm --filter realsass-ecommerce-back exec prisma generate
RUN pnpm --filter realsass-ecommerce-back run build
RUN test -f realsass-ecommerce-back/dist/src/main.js || (echo "ERROR: dist/src/main.js no generado" && exit 1)

FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/realsass-ecommerce-back/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules                         ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/realsass-ecommerce-back/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/realsass-ecommerce-back/package.json ./package.json
USER nestjs
EXPOSE 3000
CMD ["dumb-init", "node", "dist/src/main"]
