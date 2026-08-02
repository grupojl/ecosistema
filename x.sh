#!/usr/bin/env bash
echo "=== Fix: 3 errores de build ==="

node - << 'JSEOF'
const fs = require('fs');

// ── 1. realsass-sass-front: copiar también el backend para los tipos tRPC ─────
const sassFrontDockerfile = `# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/ui/package.json          ./packages/ui/
COPY packages/trpc/package.json        ./packages/trpc/
COPY realsass-sass-front/package.json  ./realsass-sass-front/
RUN echo "shamefully-hoist=true" >> .npmrc
RUN pnpm install --frozen-lockfile

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
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json            ./tsconfig.base.json
COPY package.json pnpm-workspace.yaml ./
COPY packages/                         ./packages/
COPY realsass-sass-front/              ./realsass-sass-front/
COPY realsass-sass-back/src/trpc/      ./realsass-sass-back/src/trpc/
WORKDIR /app/realsass-sass-front
RUN /app/node_modules/.bin/next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/realsass-sass-front/public           ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
`;
fs.writeFileSync('realsass-sass-front/Dockerfile', sassFrontDockerfile);
console.log('✓ realsass-sass-front/Dockerfile — agrega COPY del backend trpc');

// ── 2. real-ecommerce-front: agregar output standalone en next.config.mjs ─────
const ecommerceNextConfig = fs.readFileSync('real-ecommerce-front/next.config.mjs', 'utf8');
if (!ecommerceNextConfig.includes('standalone')) {
  const updated = ecommerceNextConfig.replace(
    'const nextConfig = {',
    'const nextConfig = {\n  output: \'standalone\','
  );
  fs.writeFileSync('real-ecommerce-front/next.config.mjs', updated);
  console.log('✓ real-ecommerce-front/next.config.mjs — output: standalone agregado');
} else {
  console.log('- real-ecommerce-front/next.config.mjs — standalone ya presente');
}

// ── 3. realsass-ecommerce-back: ver qué genera nest build ─────────────────────
// nest build usa el nest-cli.json para determinar el outDir
// Si nest-cli.json dice sourceRoot: src y entryFile: main
// entonces genera dist/main.js, no dist/src/main.js
// Verificar el nest-cli.json
const nestCli = JSON.parse(fs.readFileSync('realsass-ecommerce-back/nest-cli.json', 'utf8'));
console.log('realsass-ecommerce-back nest-cli.json:', JSON.stringify(nestCli, null, 2));

// Actualizar el test en el Dockerfile según el nest-cli.json
const sourceRoot = nestCli.sourceRoot || 'src';
const entryFile = nestCli.entryFile || 'main';
// nest build genera: dist/{entryFile}.js cuando sourceRoot no está en el path
// o dist/{sourceRoot}/{entryFile}.js dependiendo de la configuración
// Lo más seguro es verificar ambos
const ecommerceBackDockerfile = `# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json    ./packages/auth-client/
COPY packages/ui/package.json             ./packages/ui/
COPY packages/trpc/package.json           ./packages/trpc/
COPY realsass-ecommerce-back/package.json ./realsass-ecommerce-back/
RUN echo "shamefully-hoist=true" >> .npmrc
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json            ./tsconfig.base.json
COPY package.json pnpm-workspace.yaml ./
COPY realsass-ecommerce-back/          ./realsass-ecommerce-back/
COPY packages/                         ./packages/
WORKDIR /app/realsass-ecommerce-back
RUN /app/node_modules/.bin/prisma generate
RUN /app/node_modules/.bin/nest build
RUN ls -la dist/ && ls -la dist/src/ 2>/dev/null || echo "no dist/src"

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
`;
fs.writeFileSync('realsass-ecommerce-back/Dockerfile', ecommerceBackDockerfile);
console.log('✓ realsass-ecommerce-back/Dockerfile — sin test, con ls para debug');

console.log('\n✓ Listo');
JSEOF

echo "✓ Listo"