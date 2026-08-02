#!/usr/bin/env bash
echo "=== Fix: shamefully-hoist en Dockerfiles ==="

node - << 'JSEOF'
const fs = require('fs');

const backendDockerfile = (name) => `# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY ${name}/.npmrc ./.npmrc
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/ui/package.json          ./packages/ui/
COPY packages/trpc/package.json        ./packages/trpc/
COPY ${name}/package.json              ./${name}/
RUN echo "shamefully-hoist=true" >> .npmrc
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-workspace.yaml ./
COPY ${name}/                          ./${name}/
COPY packages/                         ./packages/
WORKDIR /app/${name}
RUN /app/node_modules/.bin/prisma generate
RUN /app/node_modules/.bin/nest build
RUN test -f dist/src/main.js || (echo "ERROR: dist/src/main.js no generado" && exit 1)

FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/${name}/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules         ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/${name}/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/${name}/package.json ./package.json
USER nestjs
EXPOSE 3000
CMD ["dumb-init", "node", "dist/src/main"]
`;

fs.writeFileSync('realsass-sass-back/Dockerfile', backendDockerfile('realsass-sass-back'));
console.log('✓ realsass-sass-back/Dockerfile');

fs.writeFileSync('realsass-ecommerce-back/Dockerfile', backendDockerfile('realsass-ecommerce-back'));
console.log('✓ realsass-ecommerce-back/Dockerfile');

// Frontends
const frontends = [
  {
    name: 'realsass-dashboard-front',
    envArgs: [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      'NEXT_PUBLIC_REAL_BACK_URL',
      'NEXT_PUBLIC_ECOMMERCE_API_URL',
      'NEXT_PUBLIC_STORE_FRONT_URL',
    ],
  },
  {
    name: 'realsass-sass-front',
    envArgs: [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_DASHBOARD_API_URL',
      'NEXT_PUBLIC_DASHBOARD_FRONT_URL',
      'NEXT_PUBLIC_CONFIG_API_URL',
    ],
  },
  {
    name: 'real-ecommerce-front',
    envArgs: [
      'NEXT_PUBLIC_ECOMMERCE_API_URL',
      'NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID',
      'NEXT_PUBLIC_REAL_BACK_URL',
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
    ],
  },
];

for (const { name, envArgs } of frontends) {
  const argLines = envArgs.map(e => `ARG ${e}`).join('\n');
  const envLines = envArgs.map(e => `ENV ${e}=$${e}`).join('\n');

  // Verificar si tiene .npmrc propio
  const hasNpmrc = fs.existsSync(`${name}/.npmrc`);

  fs.writeFileSync(`${name}/Dockerfile`, `# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)

FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/ui/package.json          ./packages/ui/
COPY packages/trpc/package.json        ./packages/trpc/
COPY ${name}/package.json              ./${name}/
RUN echo "shamefully-hoist=true" >> .npmrc
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate
WORKDIR /app
${argLines}
${envLines}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/                         ./packages/
COPY ${name}/                          ./${name}/
WORKDIR /app/${name}
RUN /app/node_modules/.bin/next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/${name}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/${name}/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/${name}/public           ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
`);
  console.log(`✓ ${name}/Dockerfile`);
}

console.log('\n✓ Todos los Dockerfiles con shamefully-hoist=true');
JSEOF

echo "✓ Listo"