# 06 — Dockerfile canónico: Frontend Next.js + pnpm workspace

> Patrón de referencia permanente para todo frontend Next.js del ecosistema GrupoJL.
> Aplica a: `superadmin-frontend`, `realsass-sass-front`,
> `realsass-dashboard-front`, `real-ecommerce-front`.
> Lo que está aquí no se redefine por servicio — se parametriza con ARGs y build args.

---

## Por qué este patrón y no otro

### `output: standalone` — obligatorio

`output: standalone` en `next.config.mjs` hace que Next.js genere en `.next/standalone/`
un servidor Node.js autocontenido. La imagen final no necesita copiar todos los
`node_modules` (cientos de MB) — solo lo que Next.js determinó necesario en runtime (~50-80 MB).

**Es un requisito, no una optimización.** Sin él el CMD no funciona en el contexto
del monorepo (Next.js no sabe dónde está el entry point).

Verificar en cada `next.config.mjs`:
```js
const nextConfig = {
  output: 'standalone',
};
```

### `NEXT_PUBLIC_*` como build args — no hay otra forma

Las variables `NEXT_PUBLIC_*` son **inlineadas por el compilador de Next.js en build time**.
No son variables leídas en runtime — el compilador las sustituye literalmente en el bundle.

Si no se pasan como `ARG` + `ENV` en el stage de build, quedan como `undefined` en el bundle.
Ningún `ENV` en el stage runtime puede corregirlas — ya están compiladas.

Esto no es configurable — es el comportamiento del compilador de Next.js.

### Copiar `static` y `public` separado del standalone

`output: standalone` NO incluye `.next/static/` ni `public/`.
Sin estos, la app arranca pero sin CSS, imágenes ni fuentes.

### `HOSTNAME=0.0.0.0` — obligatorio en Railway

Next.js standalone bindea a `127.0.0.1` por default.
Railway no puede acceder al contenedor si el proceso escucha solo en loopback.
Sin este ENV el health check falla y Railway revierte el deploy.

---

## Variables de entorno

**Comunes a todos los frontends** (Firebase):
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Las específicas por servicio van documentadas en `.env.example` de cada servicio.

---

## Template canónico

```dockerfile
# syntax=docker/dockerfile:1.7
# Build context: raíz del monorepo
# Reemplazar SERVICE_DIR con el nombre del servicio (ej: realsass-sass-front)

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.11.1

# ─── stage 1: dependencias ────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Ajustar según qué packages locales usa este frontend:
# COPY packages/auth-client/package.json  ./packages/auth-client/
# COPY packages/ui/package.json           ./packages/ui/
# COPY packages/trpc/package.json         ./packages/trpc/
COPY <SERVICE_DIR>/package.json           ./<SERVICE_DIR>/

RUN echo "shamefully-hoist=true" >> .npmrc

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── stage 2: build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# NEXT_PUBLIC_* DEBEN ser ARG + ENV en este stage.
# El compilador de Next.js las inlinea en el bundle en build time.
# Un ENV en el stage runtime NO puede corregirlas — ya están compiladas.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
# Variables específicas del servicio:
# ARG NEXT_PUBLIC_API_URL
# ARG NEXT_PUBLIC_SASS_BACK_URL

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
# ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules  ./node_modules
COPY tsconfig.base.json             ./
COPY package.json pnpm-workspace.yaml ./

# Ajustar según qué packages locales usa este frontend:
# COPY packages/auth-client/  ./packages/auth-client/
# COPY packages/ui/           ./packages/ui/
# COPY packages/trpc/         ./packages/trpc/
COPY <SERVICE_DIR>/             ./<SERVICE_DIR>/

WORKDIR /app/<SERVICE_DIR>

RUN /app/node_modules/.bin/next build

# ─── stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# HOSTNAME=0.0.0.0 — obligatorio en Railway.
# Next.js standalone bindea a 127.0.0.1 por default → Railway no puede acceder.
ENV HOSTNAME=0.0.0.0

# standalone: servidor Node.js autocontenido generado por Next.js.
COPY --from=build --chown=nextjs:nodejs /app/<SERVICE_DIR>/.next/standalone ./

# .next/static y public NO están en standalone — copiarlos es obligatorio.
# Sin esto la app arranca pero sin CSS, imágenes ni fuentes.
COPY --from=build --chown=nextjs:nodejs /app/<SERVICE_DIR>/.next/static \
     ./<SERVICE_DIR>/.next/static
COPY --from=build --chown=nextjs:nodejs /app/<SERVICE_DIR>/public \
     ./<SERVICE_DIR>/public

USER nextjs

EXPOSE 3000

WORKDIR /app/<SERVICE_DIR>

# standalone genera server.js — no dist/main.js (error común al copiar del backend).
CMD ["node", "server.js"]
```

---

## Requisito en `next.config.mjs`

```js
const nextConfig = {
  output: 'standalone',
};
export default nextConfig;
```

Sin esto, `node server.js` falla porque `.next/standalone/` no existe.

---

## Reglas permanentes

1. **`output: 'standalone'` en `next.config.mjs`** — prerequisito, verificar primero.
2. **Toda `NEXT_PUBLIC_*` como `ARG` + `ENV` en stage `build`** — no en runtime.
3. **Copiar `.next/static` y `public/` siempre** — no están en standalone.
4. **`HOSTNAME=0.0.0.0` en runtime** — obligatorio en Railway.
5. **`NEXT_TELEMETRY_DISABLED=1`** — en build y runtime.
6. **`CMD ["node", "server.js"]`** — standalone genera `server.js`, no `dist/main.js`.
7. **El build context es siempre la raíz del monorepo** — ver `07-railway-deploy.md`.

---

## Checklist antes de crear un Dockerfile nuevo

- [ ] `output: 'standalone'` en `next.config.mjs` del servicio
- [ ] Todos los `NEXT_PUBLIC_*` del servicio como `ARG` + `ENV` en stage `build`
- [ ] `.next/static` copiado al runtime
- [ ] `public/` copiado al runtime
- [ ] `HOSTNAME=0.0.0.0` en el stage runtime
- [ ] `CMD ["node", "server.js"]` (no `dist/main.js`)
- [ ] Usuario `nextjs` creado y activado
