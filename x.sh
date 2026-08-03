#!/usr/bin/env bash
echo "=== Fix definitivo: backends deploy paths ==="

node - << 'JSEOF'
const fs = require('fs');

const backendDockerfile = (name) => `# syntax=docker/dockerfile:1.7
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
COPY ${name}/                          ./${name}/
COPY packages/                         ./packages/
WORKDIR /app/${name}
RUN /app/node_modules/.bin/prisma generate
RUN /app/node_modules/.bin/nest build

FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/${name}/dist              ./dist
COPY --from=builder --chown=nestjs:nodejs /app/${name}/generated         ./generated
COPY --from=builder --chown=nestjs:nodejs /app/node_modules              ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/${name}/package.json      ./package.json
USER nestjs
EXPOSE 3000
CMD ["dumb-init", "node", "dist/src/main"]
`;

// sass-back: genera dist/src/main.js — path correcto
fs.writeFileSync('realsass-sass-back/Dockerfile', backendDockerfile('realsass-sass-back'));
console.log('✓ realsass-sass-back/Dockerfile');

// ecommerce-back: nest-cli.json sin entryFile → genera dist/main.js no dist/src/main.js
// Agregar entryFile al nest-cli.json para que genere en dist/src/main
const ecommerceNestCli = {
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "entryFile": "src/main",
  "compilerOptions": {
    "deleteOutDir": true
  }
};
fs.writeFileSync(
  'realsass-ecommerce-back/nest-cli.json',
  JSON.stringify(ecommerceNestCli, null, 2) + '\n'
);
console.log('✓ realsass-ecommerce-back/nest-cli.json — entryFile: src/main');

fs.writeFileSync('realsass-ecommerce-back/Dockerfile', backendDockerfile('realsass-ecommerce-back'));
console.log('✓ realsass-ecommerce-back/Dockerfile');

// El problema de generated/prisma:
// En runner WORKDIR=/app, dist está en /app/dist/src/prisma.service.js
// que hace require('../../generated/prisma')
// → /app/dist/src → ../../ → /app/generated/prisma ✓ correcto
// Copiamos generated a /app/generated → debería funcionar

console.log('\n✓ Listo');
JSEOF

echo "✓ Listo"