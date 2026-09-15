# 06 — Dockerfile canónico: Frontend Next.js + pnpm workspace

> Patrón de referencia permanente para todo frontend Next.js del ecosistema GrupoJL.
> Aplica a: `superadmin-frontend`, `realsass-sass-front`,
> `realsass-dashboard-front`, `real-ecommerce-front`.

---

## Por qué este patrón y no otro

### `output: standalone` — obligatorio

Genera en `.next/standalone/` un servidor Node.js autocontenido (~50-80 MB).
Sin él, la imagen necesita cientos de MB de `node_modules`.
Sin él, el CMD no funciona en el contexto del monorepo.

Verificar en `next.config.mjs`:
```js
const nextConfig = { output: 'standalone' };
```

### `NEXT_PUBLIC_*` como build args — no hay otra forma

Son **inlineadas por el compilador en build time**.
Si no se pasan como `ARG` + `ENV` en el stage de build, quedan como `undefined`.
Ningún `ENV` en runtime puede corregirlas.

### Copiar `static` y `public` separado

`output: standalone` NO incluye `.next/static/` ni `public/`.
Sin ellos la app arranca sin CSS, imágenes ni fuentes.

### `HOSTNAME=0.0.0.0` — obligatorio en Railway

Next.js standalone bindea a `127.0.0.1` por default.
Sin este ENV el health check falla y Railway revierte el deploy.

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
# COPY packages/auth-client/package.json ./packages/auth-client/
COPY <SERVICE_DIR>/package.json ./<SERVICE_DIR>/
RUN echo "shamefully-hoist=true" >> .npmrc
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM node:${NODE_VERSION}-alpine AS build
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
# ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY package.json pnpm-workspace.yaml ./
# COPY packages/auth-client/ ./packages/auth-client/
COPY <SERVICE_DIR>/ ./<SERVICE_DIR>/
WORKDIR /app/<SERVICE_DIR>
RUN /app/node_modules/.bin/next build

FROM node:${NODE_VERSION}-alpine AS runtime
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=nextjs:nodejs /app/<SERVICE_DIR>/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/<SERVICE_DIR>/.next/static ./<SERVICE_DIR>/.next/static
COPY --from=build --chown=nextjs:nodejs /app/<SERVICE_DIR>/public ./<SERVICE_DIR>/public
USER nextjs
EXPOSE 3000
WORKDIR /app/<SERVICE_DIR>
CMD ["node", "server.js"]
```

---

## Reglas permanentes

1. `output: 'standalone'` en `next.config.mjs` — prerequisito
2. Toda `NEXT_PUBLIC_*` como `ARG` + `ENV` en stage `build`
3. Copiar `.next/static` y `public/` siempre
4. `HOSTNAME=0.0.0.0` en runtime — obligatorio en Railway
5. `NEXT_TELEMETRY_DISABLED=1` en build y runtime
6. `CMD ["node", "server.js"]` — no `dist/main.js`

---

## Checklist

- [ ] `output: 'standalone'` en `next.config.mjs`
- [ ] Todos los `NEXT_PUBLIC_*` como `ARG` + `ENV` en stage `build`
- [ ] `.next/static` copiado al runtime
- [ ] `public/` copiado al runtime
- [ ] `HOSTNAME=0.0.0.0` en runtime
- [ ] `CMD ["node", "server.js"]`
- [ ] Usuario `nextjs` activado
