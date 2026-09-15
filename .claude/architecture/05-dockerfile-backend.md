# 05 — Dockerfile canónico: Backend NestJS + Prisma + pnpm workspace

> Patrón de referencia permanente para todo backend NestJS del ecosistema GrupoJL.
> Aplica a: `superadmin-backend`, `realsass-sass-back`, `realsass-ecommerce-back`,
> `chatia-backend`, `pasarelapagos-backend`, `notificaciones-backend`,
> `analytics-backend`, `workers-backend`.

---

## Por qué este patrón y no otro

### Imagen base: `node:22-alpine` — no distroless

Prisma genera binarios nativos del query engine en tiempo de build.
Alpine usa `musl libc`; Distroless usa `glibc` (Debian).
Si el stage de build es Alpine y el runtime es Distroless, el Prisma Query Engine
**no corre** — falla silenciosamente con error de ELF incompatible.

Decisión: `node:22-alpine` en todos los stages del backend.

### pnpm versión única: `ARG PNPM_VERSION`

Un solo ARG es la fuente de verdad. Si se actualiza el digest de la imagen base
pero no la versión de pnpm, el build rompe con error críptico de corepack.

### `prisma generate` en build, no en runtime

Correrlo en runtime agrega 3-8s al cold start. En build es determinístico y trazable.
El schema `prisma/schema.prisma` va en la imagen final. Las migrations NO van.

### Cache mounts de BuildKit: comportamiento en Railway

Los cache mounts NO persisten entre builds en Railway (runner efímero).
El beneficio real viene de la **estructura de layers**. Los mounts sí ayudan en local
y en GitHub Actions. Se mantienen en el Dockerfile.

### Usuario no-root: obligatorio

CIS Benchmarks / SOC2 / PCI. Usuario `nestjs` con UID fijo (1001).

---

## Template canónico

```dockerfile
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo
# Reemplazar SERVICE_DIR con el nombre del servicio

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.11.1

FROM node:${NODE_VERSION}-alpine AS deps
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
# COPY packages/auth-server/package.json ./packages/auth-server/
COPY <SERVICE_DIR>/package.json ./<SERVICE_DIR>/
RUN echo "shamefully-hoist=true" >> .npmrc
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM node:${NODE_VERSION}-alpine AS build
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
# COPY packages/auth-server/ ./packages/auth-server/
COPY <SERVICE_DIR>/ ./<SERVICE_DIR>/
WORKDIR /app/<SERVICE_DIR>
RUN pnpm prisma generate
RUN pnpm build

FROM node:${NODE_VERSION}-alpine AS runtime
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build --chown=nestjs:nodejs /app/node_modules               ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/<SERVICE_DIR>/dist          ./<SERVICE_DIR>/dist
COPY --from=build --chown=nestjs:nodejs /app/<SERVICE_DIR>/prisma        ./<SERVICE_DIR>/prisma
COPY --from=build --chown=nestjs:nodejs /app/<SERVICE_DIR>/package.json  ./<SERVICE_DIR>/package.json
USER nestjs
EXPOSE ${PORT}
WORKDIR /app/<SERVICE_DIR>
CMD ["node", "dist/main.js"]
```

---

## Reglas permanentes

1. `ARG PNPM_VERSION` al inicio — una sola fuente de verdad
2. `pnpm install --frozen-lockfile` siempre
3. `prisma generate` en stage `build`, antes de `pnpm build`
4. Solo `prisma/schema.prisma` en runtime — migrations NO van en la imagen
5. `shamefully-hoist=true` — no es opcional en este stack
6. Build context siempre la raíz del monorepo — ver `07-railway-deploy.md`
7. Nunca `npm install` ni `yarn`

---

## Checklist

- [ ] `ARG PNPM_VERSION` definido al inicio
- [ ] Solo `package.json` copiados en stage `deps` (no el source)
- [ ] `pnpm install --frozen-lockfile` con cache mount
- [ ] `prisma generate` antes de `pnpm build`
- [ ] Runtime copia solo `dist/`, `node_modules`, `prisma/schema.prisma`, `package.json`
- [ ] Usuario `nestjs` activado antes del CMD
- [ ] `CMD ["node", "dist/main.js"]`
