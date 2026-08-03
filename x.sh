#!/usr/bin/env bash
echo "=== Fix: invalidar cache Railway + node_modules en runner ==="

node - << 'JSEOF'
const fs = require('fs');

const frontends = [
  {
    name: 'realsass-dashboard-front',
    envArgs: [
      'NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID','NEXT_PUBLIC_FIREBASE_APP_ID',
      'NEXT_PUBLIC_REAL_BACK_URL','NEXT_PUBLIC_ECOMMERCE_API_URL','NEXT_PUBLIC_STORE_FRONT_URL',
    ],
  },
  {
    name: 'realsass-sass-front',
    envArgs: [
      'NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID','NEXT_PUBLIC_FIREBASE_APP_ID',
      'NEXT_PUBLIC_API_URL','NEXT_PUBLIC_DASHBOARD_API_URL',
      'NEXT_PUBLIC_DASHBOARD_FRONT_URL','NEXT_PUBLIC_CONFIG_API_URL',
    ],
  },
  {
    name: 'real-ecommerce-front',
    envArgs: [
      'NEXT_PUBLIC_ECOMMERCE_API_URL','NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID',
      'NEXT_PUBLIC_REAL_BACK_URL','NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
    ],
  },
];

for (const { name, envArgs } of frontends) {
  const argLines = envArgs.map(e => `ARG ${e}`).join('\n');
  const envLines = envArgs.map(e => `ENV ${e}=$${e}`).join('\n');

  fs.writeFileSync(`${name}/Dockerfile`, `# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)
# cache-bust: 2026-08-03-v2

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
COPY tsconfig.base.json            ./tsconfig.base.json
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
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules             ./node_modules
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
`);
  console.log(`✓ ${name}/Dockerfile — cache-bust aplicado`);
}
JSEOF

echo "✓ Listo"