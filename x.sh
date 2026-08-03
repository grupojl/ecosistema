#!/usr/bin/env bash
echo "=== Fix: revertir Prisma output custom → @prisma/client ==="

node - << 'JSEOF'
const fs = require('fs');

// Revertir schema.prisma — quitar output custom
// Cada backend tendrá su propio @prisma/client en node_modules
// pnpm con shamefully-hoist los diferencia por el hash del schema

for (const name of ['realsass-sass-back', 'realsass-ecommerce-back']) {
  const schemaPath = `${name}/prisma/schema.prisma`;
  let schema = fs.readFileSync(schemaPath, 'utf8');

  // Quitar la línea output = "../generated/prisma"
  schema = schema.replace(/\s*output\s*=\s*"\.\.\/generated\/prisma"\n?/g, '\n');
  fs.writeFileSync(schemaPath, schema);
  console.log(`✓ ${schemaPath} — output custom removido`);
}

// Revertir prisma.service.ts de ambos backends — importar desde @prisma/client
for (const name of ['realsass-sass-back', 'realsass-ecommerce-back']) {
  const svcPath = `${name}/src/prisma/prisma.service.ts`;
  let svc = fs.readFileSync(svcPath, 'utf8');
  svc = svc.replace(/from '\.\.\/\.\.\/generated\/prisma'/g, "from '@prisma/client'");
  svc = svc.replace(/from '\.\/generated\/prisma'/g, "from '@prisma/client'");
  fs.writeFileSync(svcPath, svc);
  console.log(`✓ ${svcPath} — importa desde @prisma/client`);
}

// Actualizar Dockerfiles — quitar COPY generated, usar @prisma/client del hoisting
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

console.log('\n✓ Listo');
JSEOF

echo "✓ Listo"