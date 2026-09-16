# 05 — Dockerfile canónico: Backend NestJS + Prisma + pnpm workspace

> Patrón de referencia permanente para todo backend NestJS del ecosistema GrupoJL.
> Aplica a: `realsass-sass-back`, `realsass-ecommerce-back`.
>
> Nivel de referencia: **Stripe internal services** — multi-stage, señales correctas,
> migrate deploy atómico, escaneo de imagen en CI, build reproducible por plataforma.

---

## Decisiones de arquitectura

### `node:22-alpine` en todos los stages — no distroless

Prisma genera binarios nativos del query engine en build time.
Alpine usa `musl libc`; Distroless usa `glibc` (Debian).
Si el stage de build es Alpine y el runtime es Distroless, el Prisma Query Engine
falla silenciosamente con error de ELF incompatible.

**Decisión:** `node:22-alpine` en todos los stages. Sin excepciones.

### `--platform linux/amd64` — plataforma explícita

Sin `--platform`, un build desde Mac ARM (M1/M2/M3) genera una imagen `arm64`.
Railway corre `linux/amd64`. La imagen se ejecuta emulada (30-50% más lenta)
o falla silenciosamente según la versión del runner.

**Decisión:** `--platform linux/amd64` declarado en cada `FROM`. El Dockerfile
es el contrato de la plataforma — no puede depender del host que hace el build.

### `dumb-init` — PID 1 correcto

Node.js no fue diseñado para correr como PID 1. Sin un init process:
- `SIGTERM` de Railway en redeploy no propaga a los workers de Node → Railway
  espera 10s y mata con `SIGKILL` → BullMQ jobs y conexiones tRPC cortadas abruptamente.
- Procesos zombie de child processes no son recolectados.

`dumb-init` intercepta las señales y las reenvía al proceso hijo correctamente.
Se instala en `deps` (layer cacheada) y se usa en `runtime`.

**Decisión:** `dumb-init` obligatorio en todos los backends. Sin excepciones.

### `entrypoint.sh` — migrate deploy atómico antes del arranque

`prisma migrate deploy` debe correr antes de que el servidor acepte tráfico.
Si se corre después (o no se corre), el servicio arranca contra una DB con schema
desactualizado y falla en runtime con errores de columna inexistente.

El `entrypoint.sh` garantiza el orden: migrate → start. Es idempotente: si no
hay migrations pendientes, termina en < 100ms sin efecto.

**Decisión:** `CMD` nunca apunta a `node` directamente. Siempre a `dumb-init` + `entrypoint.sh`.

### `prisma generate` en build, no en runtime

Correrlo en runtime agrega 3-8s al cold start y no es determinístico.
El query engine nativo (binario musl) se genera una sola vez en el stage `build`.

### `ARG PNPM_VERSION` — fuente de verdad única

Un solo ARG al inicio del Dockerfile. Si se actualiza el digest de la imagen
base sin actualizar la versión de pnpm, el build rompe con error críptico de corepack.

### Cache mounts de BuildKit

No persisten entre builds en Railway (runner efímero).
El beneficio viene de la estructura de layers, no del mount.
Los mounts sí aceleran builds locales y GitHub Actions. Se mantienen.

### Trivy — escaneo de la imagen en CI

La imagen contiene binarios del OS Alpine, Node.js, y las dependencias npm.
Trivy escanea la imagen final en GitHub Actions antes de que Railway la deployee.
Falla el build si hay CVEs `CRITICAL` o `HIGH` con fix disponible.

**Decisión:** Trivy corre en CI como paso bloqueante post-build. No en el Dockerfile.

### Cosign — firma de imagen (supply chain)

Cosign firma criptográficamente la imagen después de pushear a GHCR.
Permite verificar que la imagen que Railway deployea es exactamente la que
GitHub Actions construyó — sin modificaciones en tránsito.

**Decisión:** activar cuando el primer servicio reciba tráfico externo real.
El flujo CI ya contempla el paso — es un uncomment, no una reescritura.

---

## Puertos por servicio

| Servicio                 | HTTP | Rol                                      |
|--------------------------|------|------------------------------------------|
| realsass-sass-back       | 3000 | identidad, orgs, colaboradores, BullMQ   |
| realsass-ecommerce-back  | 3001 | catálogo, stock, órdenes, tRPC           |

Ambos usan `packages/auth-server` y `packages/trpc`.
`realsass-ecommerce-back` usa PORT=3001 para evitar colisión en VPS/local.

---

## Template canónico — Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)
# Reemplazar <SERVICE_DIR>  → nombre del servicio (ej: realsass-sass-back)
# Reemplazar <SERVICE_PORT> → puerto HTTP (3000 ó 3001)
#
# Railway  → Root Directory: /  |  Dockerfile Path: <SERVICE_DIR>/Dockerfile
# CI/CD    → ver .github/workflows/ci-<SERVICE_DIR>.yml

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps

RUN apk add --no-cache dumb-init
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-server/package.json  ./packages/auth-server/
COPY packages/trpc/package.json         ./packages/trpc/
COPY <SERVICE_DIR>/package.json         ./<SERVICE_DIR>/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-<SERVICE_DIR>,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY packages/auth-server/              ./packages/auth-server/
COPY packages/trpc/                     ./packages/trpc/
COPY <SERVICE_DIR>/                     ./<SERVICE_DIR>/

WORKDIR /app/<SERVICE_DIR>

RUN pnpm prisma generate
RUN pnpm build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS runtime

RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app/<SERVICE_DIR>

ENV NODE_ENV=production
ENV PORT=<SERVICE_PORT>

COPY --from=build --chown=nestjs:nodejs /app/node_modules                         ../node_modules
COPY --from=build --chown=nestjs:nodejs /app/<SERVICE_DIR>/dist                   ./dist
COPY --from=build --chown=nestjs:nodejs /app/<SERVICE_DIR>/prisma                 ./prisma
COPY --from=build --chown=nestjs:nodejs /app/<SERVICE_DIR>/package.json           ./package.json
COPY --chown=nestjs:nodejs <SERVICE_DIR>/entrypoint.sh                            ./entrypoint.sh

USER nestjs
EXPOSE <SERVICE_PORT>

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:<SERVICE_PORT>/health || exit 1

CMD ["dumb-init", "/app/<SERVICE_DIR>/entrypoint.sh"]
```

---

## Template canónico — entrypoint.sh

Crear en `<SERVICE_DIR>/entrypoint.sh` con `chmod +x`:

```sh
#!/bin/sh
set -e

echo "[entrypoint] Running prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Starting server..."
exec node dist/main.js
```

> `exec` reemplaza el shell con Node — dumb-init recibe las señales directamente.

---

## GitHub Actions — pipeline por servicio

```yaml
# .github/workflows/ci-<SERVICE_DIR>.yml
name: CI — <SERVICE_DIR>

on:
  push:
    branches: [main]
    paths:
      - '<SERVICE_DIR>/**'
      - 'packages/**'
      - 'package.json'
      - 'pnpm-workspace.yaml'
  pull_request:
    paths:
      - '<SERVICE_DIR>/**'
      - 'packages/**'

jobs:
  ci:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '10' }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile

      - run: pnpm --filter=<SERVICE_DIR> typecheck
      - run: pnpm --filter=<SERVICE_DIR> lint
      - run: pnpm --filter=<SERVICE_DIR> test:cov
      - run: pnpm audit --audit-level=high

      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        if: github.ref == 'refs/heads/main'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: <SERVICE_DIR>/Dockerfile
          platforms: linux/amd64
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: ghcr.io/${{ github.repository }}/<SERVICE_DIR>:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan image — Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}/<SERVICE_DIR>:${{ github.sha }}
          format: table
          exit-code: '1'
          severity: CRITICAL,HIGH
          ignore-unfixed: true

      - name: Sign image — Cosign
        if: github.ref == 'refs/heads/main'
        uses: sigstore/cosign-installer@v3
      - run: cosign sign --yes ghcr.io/${{ github.repository }}/<SERVICE_DIR>:${{ github.sha }}
        if: github.ref == 'refs/heads/main'
        env: { COSIGN_EXPERIMENTAL: '1' }
```

---

## Reglas permanentes

1. `--platform linux/amd64` en cada `FROM`
2. `dumb-init` en `deps` y `runtime`
3. `entrypoint.sh` con `prisma migrate deploy`
4. `exec node dist/main.js` en entrypoint
5. `prisma generate` en stage `build`, antes de `pnpm build`
6. `pnpm install --frozen-lockfile` siempre
7. `shamefully-hoist=true` — no es opcional en este stack
8. Solo `dist/`, `node_modules`, `prisma/`, `package.json` en runtime
9. Usuario `nestjs` UID 1001 — CIS Benchmarks / SOC2 / PCI
10. Build context siempre la raíz del monorepo
11. `pnpm audit --audit-level=high` en CI
12. Trivy sobre la imagen final en CI
13. Cosign firma la imagen en main

---

## Checklist — Dockerfile

- [ ] `--platform linux/amd64` en cada `FROM`
- [ ] `dumb-init` en stage `deps`
- [ ] `ARG PNPM_VERSION` al inicio
- [ ] Solo `package.json` en stage `deps`
- [ ] `pnpm install --frozen-lockfile` con cache mount id único
- [ ] `prisma generate` antes de `pnpm build`
- [ ] `dumb-init` en stage `runtime`
- [ ] Runtime copia solo `dist/`, `node_modules`, `prisma/`, `package.json`
- [ ] `entrypoint.sh` copiado con `--chown=nestjs:nodejs`
- [ ] Usuario `nestjs` antes del CMD
- [ ] `HEALTHCHECK` con puerto hardcodeado
- [ ] `CMD ["dumb-init", "/app/<SERVICE_DIR>/entrypoint.sh"]`

## Checklist — entrypoint.sh

- [ ] `#!/bin/sh` + `set -e`
- [ ] `prisma migrate deploy` antes de arrancar
- [ ] `exec node dist/main.js`
- [ ] `chmod +x` aplicado

## Checklist — GitHub Actions

- [ ] `pnpm audit --audit-level=high` sin vulnerabilidades
- [ ] Build con `platforms: linux/amd64`
- [ ] Trivy — exit-code 1 en CRITICAL/HIGH con fix
- [ ] Cosign firma en push a main
- [ ] Path filters por servicio y packages/
