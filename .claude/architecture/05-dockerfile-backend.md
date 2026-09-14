# 05 — Dockerfile canónico: Backend NestJS + Prisma + pnpm workspace

> Patrón de referencia permanente para todo backend NestJS del ecosistema GrupoJL.
> Aplica a: `superadmin-backend`, `realsass-sass-back`, `realsass-ecommerce-back`,
> `chatia-backend`, `pasarelapagos-backend`, `notificaciones-backend`,
> `analytics-backend`, `workers-backend`.
> Lo que está aquí no se redefine por servicio — se parametriza con ARGs.

---

## Por qué este patrón y no otro

### Imagen base: `node:22-alpine` — no distroless

Prisma genera binarios nativos del query engine en tiempo de build.
Alpine usa `musl libc`; Distroless (gcr.io/distroless) usa `glibc` (Debian).
Si el stage de build es Alpine y el runtime es Distroless, el Prisma Query Engine
compilado en Alpine **no corre en Distroless** — falla silenciosamente con un error
de ELF incompatible a las 2am en Railway.

Decisión: `node:22-alpine` en todos los stages del backend. Superficie de ataque
mínima sin el riesgo de incompatibilidad de libc. Revisar si se migra a Debian
cuando Prisma soporte distroless oficialmente.

### pnpm versión única: `ARG PNPM_VERSION`

Un solo ARG al inicio del Dockerfile es la fuente de verdad de la versión de pnpm.
Si se actualiza el digest de la imagen base pero no la versión de pnpm (o viceversa),
el build rompe con un error críptico de corepack. Pin único = un solo lugar para actualizar.

### Estructura de stages: deps → build → runtime

```
deps    — instala node_modules una vez, con cache mount de pnpm store
build   — compila TypeScript + genera Prisma client
runtime — copia solo dist/ + node_modules + prisma/schema.prisma
```

El stage `deps` copia SOLO los `package.json` (workspace root + packages + servicio)
antes del `pnpm install`. Esto preserva el layer de dependencias en cache:
si solo cambia código fuente, Docker reutiliza el layer de `node_modules`.

### `prisma generate` en build, no en runtime

`prisma generate` lee el schema y genera el client TypeScript + los binarios nativos.
Correrlo en runtime agrega 3-8 segundos al cold start y requiere las herramientas
de Prisma en la imagen de producción. En build es determinístico y trazable.

El schema `prisma/schema.prisma` sí va en la imagen final. Las migrations NO van
(solo se corren desde CI/CD o un job separado antes del deploy).

### Cache mounts de BuildKit: comportamiento en Railway

Los cache mounts (`--mount=type=cache`) persisten **dentro de un build** pero
Railway usa runners efímeros — el cache se descarta entre builds.
El beneficio real en Railway viene de la **estructura de layers**, no de los mounts.
Los cache mounts se mantienen en el Dockerfile porque sí aceleran builds locales
y en GitHub Actions con runner con estado.

### Usuario no-root: obligatorio

CIS Benchmarks y cualquier política SOC2/PCI exigen contenedores sin root.
Se crea un usuario `nestjs` con UID fijo (1001) para reproducibilidad entre builds.

---

## Template canónico

```dockerfile
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo
# Reemplazar SERVICE_DIR con el nombre del servicio (ej: chatia-backend)

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.11.1

# ─── stage 1: dependencias ────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copiar SOLO package.json antes del install — preserva cache de node_modules.
# Si solo cambia código fuente, Docker reutiliza el layer de node_modules.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Ajustar según qué packages locales usa este servicio:
# COPY packages/auth-server/package.json  ./packages/auth-server/
# COPY packages/proto/package.json        ./packages/proto/
# COPY packages/grpc-client/package.json  ./packages/grpc-client/
COPY <SERVICE_DIR>/package.json           ./<SERVICE_DIR>/

# shamefully-hoist: pone todo en node_modules raíz.
# Necesario para que NestJS resuelva los packages del workspace.
RUN echo "shamefully-hoist=true" >> .npmrc

# Cache mount: acelera builds locales y en GitHub Actions.
# En Railway (runner efímero) no persiste — el beneficio viene del layer cache.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules  ./node_modules
COPY tsconfig.base.json             ./

# Ajustar según qué packages locales usa este servicio:
# COPY packages/auth-server/  ./packages/auth-server/
# COPY packages/proto/        ./packages/proto/
# COPY packages/grpc-client/  ./packages/grpc-client/
COPY <SERVICE_DIR>/             ./<SERVICE_DIR>/

WORKDIR /app/<SERVICE_DIR>

# prisma generate en build, no en runtime:
# - determinístico y trazable
# - evita 3-8s de cold start en Railway
# - binarios nativos del query engine compilados para alpine
RUN pnpm prisma generate

RUN pnpm build

# ─── stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

# Usuario no-root — CIS Benchmarks / SOC2 / PCI
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Solo lo necesario en producción:
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

1. **`ARG PNPM_VERSION` al inicio** — una sola fuente de verdad. Si se actualiza,
   se actualiza aquí y se propaga a todos los Dockerfiles.

2. **`pnpm install --frozen-lockfile` siempre** — nunca `--no-frozen-lockfile` en producción.
   Si el lockfile está desactualizado, el build falla explícitamente.

3. **`prisma generate` en stage `build`, antes de `pnpm build`** — nunca en CMD ni entrypoint.

4. **Solo `prisma/schema.prisma` en runtime** — las migrations NO van en la imagen.

5. **`shamefully-hoist=true` en `.npmrc`** — no es opcional en este stack.

6. **El build context es siempre la raíz del monorepo** — ver `07-railway-deploy.md`.

7. **Nunca `npm install` ni `yarn`** — pnpm es el gestor único del ecosistema.

---

## Checklist antes de crear un Dockerfile nuevo

- [ ] `ARG PNPM_VERSION` definido al inicio con la versión actual del workspace
- [ ] Solo los `package.json` necesarios copiados en stage `deps` (no el source)
- [ ] `pnpm install --frozen-lockfile` con cache mount
- [ ] `prisma generate` antes de `pnpm build` en stage `build`
- [ ] Stage `runtime` copia solo `dist/`, `node_modules`, `prisma/schema.prisma`, `package.json`
- [ ] Usuario `nestjs` creado y activado antes del CMD
- [ ] `WORKDIR` apunta al directorio del servicio en el runtime
- [ ] `CMD ["node", "dist/main.js"]` — sin shell wrapper innecesario
