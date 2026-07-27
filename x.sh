#!/usr/bin/env bash
# setup-railway.sh
# Configura todos los servicios del monorepo para Railway
# Elimina configs viejas y crea las nuevas adaptadas al monorepo
# Corre desde welver/

set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${BLUE}[→]${NC} $1"; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }

# =============================================================================
# 1. LIMPIAR configs viejas
# =============================================================================
log "Eliminando configs viejas..."

rm -f realsass-sass-back/Dockerfile
rm -f realsass-sass-back/railway.json
rm -f realsass-sass-front/nixpacks.toml
rm -f realsass-sass-front/railway.json
rm -f realsass-ecommerce-back/railway.json
rm -f realsass-dashboard-front/railway.json
rm -f real-ecommerce-front/railway.json

ok "Configs viejas eliminadas"

# =============================================================================
# 2. railway.json RAÍZ
# Railway lee este archivo para saber que es un monorepo
# =============================================================================
log "Creando railway.json raíz..."
cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
EOF
ok "railway.json raíz listo"

# =============================================================================
# 3. realsass-sass-back — NestJS con Prisma (Dockerfile)
# =============================================================================
log "Configurando realsass-sass-back..."

cat > realsass-sass-back/Dockerfile << 'EOF'
# syntax=docker/dockerfile:1.7
# =============================================================================
# realsass-sass-back — Monorepo build
# Contexto: raíz de welver/ (Railway usa el repo completo)
# =============================================================================

# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Archivos del workspace (raíz del monorepo)
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY packages/ ./packages/

# package.json de todos los workspaces para que pnpm resuelva el catalog
COPY realsass-sass-back/package.json      ./realsass-sass-back/
COPY realsass-ecommerce-back/package.json ./realsass-ecommerce-back/
COPY realsass-sass-front/package.json     ./realsass-sass-front/
COPY realsass-dashboard-front/package.json ./realsass-dashboard-front/
COPY real-ecommerce-front/package.json    ./real-ecommerce-front/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=development

# Copiar workspace completo
COPY --from=deps /app/node_modules         ./node_modules
COPY --from=deps /app/packages             ./packages
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY realsass-sass-back/                   ./realsass-sass-back/

# Generar Prisma client y buildear
WORKDIR /app/realsass-sass-back
RUN pnpm exec prisma generate
RUN pnpm run build
RUN test -f dist/src/main.js || (echo "ERROR: dist/src/main.js no generado" && exit 1)

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/realsass-sass-back/dist         ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules                    ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/realsass-sass-back/prisma       ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/realsass-sass-back/package.json ./package.json

USER nestjs
EXPOSE 3000
CMD ["dumb-init", "node", "dist/src/main"]
EOF

cat > realsass-sass-back/railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "realsass-sass-back/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
EOF

ok "realsass-sass-back listo"

# =============================================================================
# 4. realsass-ecommerce-back — NestJS con Prisma (Dockerfile)
# =============================================================================
log "Configurando realsass-ecommerce-back..."

cat > realsass-ecommerce-back/Dockerfile << 'EOF'
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
EOF

cat > realsass-ecommerce-back/railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "realsass-ecommerce-back/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
EOF

ok "realsass-ecommerce-back listo"

# =============================================================================
# 5. realsass-sass-front — Next.js (Nixpacks)
# =============================================================================
log "Configurando realsass-sass-front..."

cat > realsass-sass-front/nixpacks.toml << 'EOF'
[variables]
NIXPACKS_NODE_VERSION = "22"
NODE_ENV = "production"
HOSTNAME = "0.0.0.0"
PORT = "3000"

[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
cmds = [
  "corepack enable",
  "corepack prepare pnpm@latest --activate",
  "pnpm install --frozen-lockfile --ignore-scripts"
]

[phases.build]
cmds = [
  "pnpm --filter realsass-sass-front run build"
]

[phases.postbuild]
cmds = [
  "cp -r realsass-sass-front/.next/static realsass-sass-front/.next/standalone/.next/static",
  "cp -r realsass-sass-front/public realsass-sass-front/.next/standalone/public"
]

[start]
cmd = "node realsass-sass-front/.next/standalone/server.js"
EOF

cat > realsass-sass-front/railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
EOF

ok "realsass-sass-front listo"

# =============================================================================
# 6. realsass-dashboard-front — Next.js (Nixpacks)
# =============================================================================
log "Configurando realsass-dashboard-front..."

cat > realsass-dashboard-front/nixpacks.toml << 'EOF'
[variables]
NIXPACKS_NODE_VERSION = "22"
NODE_ENV = "production"
HOSTNAME = "0.0.0.0"
PORT = "3000"

[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
cmds = [
  "corepack enable",
  "corepack prepare pnpm@latest --activate",
  "pnpm install --frozen-lockfile --ignore-scripts"
]

[phases.build]
cmds = [
  "pnpm --filter realsass-dashboard-front run build"
]

[phases.postbuild]
cmds = [
  "cp -r realsass-dashboard-front/.next/static realsass-dashboard-front/.next/standalone/.next/static",
  "cp -r realsass-dashboard-front/public realsass-dashboard-front/.next/standalone/public"
]

[start]
cmd = "node realsass-dashboard-front/.next/standalone/server.js"
EOF

cat > realsass-dashboard-front/railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
EOF

ok "realsass-dashboard-front listo"

# =============================================================================
# 7. real-ecommerce-front — Next.js (Nixpacks)
# =============================================================================
log "Configurando real-ecommerce-front..."

cat > real-ecommerce-front/nixpacks.toml << 'EOF'
[variables]
NIXPACKS_NODE_VERSION = "22"
NODE_ENV = "production"
HOSTNAME = "0.0.0.0"
PORT = "3000"

[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
cmds = [
  "corepack enable",
  "corepack prepare pnpm@latest --activate",
  "pnpm install --frozen-lockfile --ignore-scripts"
]

[phases.build]
cmds = [
  "pnpm --filter real-ecommerce-front run build"
]

[phases.postbuild]
cmds = [
  "cp -r real-ecommerce-front/.next/static real-ecommerce-front/.next/standalone/.next/static",
  "cp -r real-ecommerce-front/public real-ecommerce-front/.next/standalone/public"
]

[start]
cmd = "node real-ecommerce-front/.next/standalone/server.js"
EOF

cat > real-ecommerce-front/railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
EOF

ok "real-ecommerce-front listo"

# =============================================================================
# 8. pnpm-lock.yaml en la raíz (Railway lo necesita para --frozen-lockfile)
# =============================================================================
log "Regenerando pnpm-lock.yaml..."
pnpm install --ignore-scripts
ok "pnpm-lock.yaml regenerado"

echo ""
echo "================================================================"
echo "  RAILWAY CONFIGURADO"
echo "================================================================"
echo ""
echo "  Próximos pasos en Railway dashboard:"
echo ""
echo "  1. Crear un proyecto nuevo en railway.app"
echo "  2. Conectar el repo grupojl/ecosistema"
echo "  3. Agregar 5 servicios — uno por cada app:"
echo ""
echo "     Servicio              Root Directory"
echo "     ─────────────────     ──────────────────────────"
echo "     realsass-sass-back    /realsass-sass-back"
echo "     realsass-ecom-back    /realsass-ecommerce-back"
echo "     realsass-sass-front   /realsass-sass-front"
echo "     realsass-dashboard    /realsass-dashboard-front"
echo "     real-ecommerce-front  /real-ecommerce-front"
echo ""
echo "  4. Agregar variables de entorno a cada servicio"
echo "  5. Deploy"
echo ""
echo "  IMPORTANTE: en Railway, cada servicio necesita"
echo "  'Root Directory' apuntando a su subcarpeta."
echo "  Railway va a usar el railway.json de esa subcarpeta."
echo ""