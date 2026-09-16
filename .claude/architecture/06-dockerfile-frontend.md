# 06 — Dockerfile canónico: Frontend Next.js + pnpm workspace

> Patrón de referencia permanente para todo frontend Next.js del ecosistema GrupoJL.
> Aplica a: `realsass-sass-front`, `realsass-dashboard-front`, `real-ecommerce-front`.
>
> Nivel de referencia: **Vercel self-hosting guide** — standalone output, build args
> compile-time, imagen mínima, escaneo en CI, build reproducible por plataforma.

---

## Decisiones de arquitectura

### `output: 'standalone'` — obligatorio

Genera en `.next/standalone/` un servidor Node.js autocontenido (~50-80 MB).
Sin él, la imagen necesita los `node_modules` completos del monorepo (500MB+).
Sin él, el `CMD ["node", "server.js"]` no existe y el contenedor no arranca.

Verificar en `next.config.mjs`:
```js
const nextConfig = { output: 'standalone' };
```

### `NEXT_PUBLIC_*` como ARG de build — no hay alternativa

Las variables `NEXT_PUBLIC_*` son **inlineadas por el compilador de Next.js
en el bundle de JavaScript** en build time. No son variables de entorno en runtime.

Si no se pasan como `ARG` + `ENV` en el stage `build`, quedan como `undefined`.
Ningún `ENV` en runtime puede recuperarlas.

En Railway: configurar como **Build Variables** (no solo Runtime Variables).

### `static` y `public` copiados por separado — obligatorio

`output: standalone` NO incluye `.next/static/` ni `public/`.
Sin `.next/static/`: pantalla en blanco (sin CSS ni JS del cliente).
Sin `public/`: sin imágenes, fuentes ni favicons.

### `HOSTNAME=0.0.0.0` — obligatorio en Railway

Next.js standalone bindea a `127.0.0.1` por default.
Sin este ENV el health check de Railway falla → deploy revertido automáticamente.

### `--platform linux/amd64` — plataforma explícita

Sin `--platform`, un build desde Mac ARM genera una imagen `arm64`.
Railway corre `linux/amd64`. La imagen se ejecuta emulada o falla.

### `NEXT_TELEMETRY_DISABLED=1` — en build y runtime

En contenedores en red privada Railway los intentos de conexión a Vercel
generan timeouts que alargan el cold start. Desactivar siempre.

### Trivy y Cosign — misma decisión que en backends

Ver `05-dockerfile-backend.md` para el razonamiento completo.

---

## Packages compartidos por frontend

| Frontend                  | packages usados                              |
|---------------------------|----------------------------------------------|
| realsass-sass-front       | auth-client · ui · trpc                      |
| realsass-dashboard-front  | auth-client · ui · trpc                      |
| real-ecommerce-front      | auth-client · ui · trpc                      |

---

## Template canónico — Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo (welver/)
# Reemplazar <SERVICE_DIR> → nombre del servicio (ej: realsass-sass-front)
#
# PREREQUISITO: next.config.mjs debe tener output: 'standalone'
#
# Railway  → Root Directory: /  |  Dockerfile Path: <SERVICE_DIR>/Dockerfile
# CI/CD    → ver .github/workflows/ci-<SERVICE_DIR>.yml

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.30.3

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/auth-client/package.json  ./packages/auth-client/
COPY packages/ui/package.json           ./packages/ui/
COPY packages/trpc/package.json         ./packages/trpc/
COPY <SERVICE_DIR>/package.json         ./<SERVICE_DIR>/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm-<SERVICE_DIR>,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# NEXT_PUBLIC_* inlineadas en compile-time — un ENV en runtime NO las recupera
# Railway: configurar como "Build Variables" en el servicio
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
# ARGs específicos por servicio — descomentar según corresponda:
# ARG NEXT_PUBLIC_SASS_BACK_URL          ← sass-front, dashboard-front
# ARG NEXT_PUBLIC_ECOMMERCE_API_URL      ← dashboard-front, ecommerce-front
# ARG NEXT_PUBLIC_STORE_FRONT_URL        ← dashboard-front
# ARG NEXT_PUBLIC_SASS_FRONT_URL         ← dashboard-front
# ARG NEXT_PUBLIC_DASHBOARD_FRONT_URL    ← sass-front

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
# ENVs específicos — descomentar los que apliquen al servicio
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules      ./node_modules
COPY tsconfig.base.json                 ./
COPY package.json pnpm-workspace.yaml   ./
COPY packages/auth-client/              ./packages/auth-client/
COPY packages/ui/                       ./packages/ui/
COPY packages/trpc/                     ./packages/trpc/
COPY <SERVICE_DIR>/                     ./<SERVICE_DIR>/

WORKDIR /app/<SERVICE_DIR>
RUN /app/node_modules/.bin/next build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=nextjs:nodejs /app/<SERVICE_DIR>/.next/standalone      ./
COPY --from=build --chown=nextjs:nodejs /app/<SERVICE_DIR>/.next/static          ./<SERVICE_DIR>/.next/static
COPY --from=build --chown=nextjs:nodejs /app/<SERVICE_DIR>/public                ./<SERVICE_DIR>/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

WORKDIR /app/<SERVICE_DIR>
CMD ["node", "server.js"]
```

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
          build-args: |
            NEXT_PUBLIC_FIREBASE_API_KEY=${{ secrets.NEXT_PUBLIC_FIREBASE_API_KEY }}
            NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${{ secrets.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN }}
            NEXT_PUBLIC_FIREBASE_PROJECT_ID=${{ secrets.NEXT_PUBLIC_FIREBASE_PROJECT_ID }}
            NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${{ secrets.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }}
            NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${{ secrets.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }}
            NEXT_PUBLIC_FIREBASE_APP_ID=${{ secrets.NEXT_PUBLIC_FIREBASE_APP_ID }}
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

1. `output: 'standalone'` en `next.config.mjs` — prerequisito absoluto
2. `--platform linux/amd64` en cada `FROM`
3. Toda `NEXT_PUBLIC_*` como `ARG` + `ENV` en stage `build`
4. Copiar `.next/static/` y `public/` siempre
5. `HOSTNAME=0.0.0.0` en runtime
6. `NEXT_TELEMETRY_DISABLED=1` en build y runtime
7. `CMD ["node", "server.js"]` — nunca `dist/main.js`
8. Usuario `nextjs` UID 1001
9. `pnpm audit --audit-level=high` en CI
10. Trivy sobre la imagen final en CI
11. Cosign firma la imagen en main
12. `build-args` de Firebase en GitHub Secrets — nunca en el Dockerfile

---

## Checklist — Dockerfile

- [ ] `output: 'standalone'` en `next.config.mjs`
- [ ] `--platform linux/amd64` en cada `FROM`
- [ ] `ARG PNPM_VERSION` al inicio
- [ ] Solo `package.json` en stage `deps`
- [ ] `pnpm install --frozen-lockfile` con cache mount id único
- [ ] Todos los `NEXT_PUBLIC_*` como `ARG` + `ENV` en stage `build`
- [ ] `.next/static/` copiado al runtime
- [ ] `public/` copiado al runtime
- [ ] `HOSTNAME=0.0.0.0` en runtime
- [ ] `NEXT_TELEMETRY_DISABLED=1` en build y runtime
- [ ] Usuario `nextjs` antes del CMD
- [ ] `CMD ["node", "server.js"]`

## Checklist — GitHub Actions

- [ ] `NEXT_PUBLIC_*` como secrets en GitHub Actions
- [ ] `pnpm audit --audit-level=high` sin vulnerabilidades
- [ ] Build con `platforms: linux/amd64`
- [ ] `build-args` pasan los secrets al build
- [ ] Trivy — exit-code 1 en CRITICAL/HIGH con fix
- [ ] Cosign firma en push a main
- [ ] Path filters por servicio y packages/
