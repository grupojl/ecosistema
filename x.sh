#!/usr/bin/env bash
# x.sh — Aplica los documentos de arquitectura a los 3 monorepos
#
# Uso: bash x.sh  (desde cualquier lugar — se ubica solo)
# O via Makefile: make x  (desde dentro de cualquier repo)
#
# Archivos que escribe en cada repo (.claude/architecture/):
#   05-dockerfile-backend.md
#   06-dockerfile-frontend.md
#   07-railway-deploy.md
#   08-testing-norte.md
#   09-observabilidad-norte.md

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}[x.sh]${NC} $*"; }
success() { echo -e "${GREEN}[x.sh]${NC} $*"; }
warn()    { echo -e "${YELLOW}[x.sh]${NC} $*"; }
die()     { echo -e "${RED}[x.sh]${NC} $*"; exit 1; }

REPOS=("superadmin" "ecosistema" "ecosistema-ms")

# ─── ubicar la carpeta padre de los 3 repos ──────────────────────────────────
find_root() {
  local candidates=(
    "."
    ".."
    "$(dirname "${BASH_SOURCE[0]}")/.."
    "$(dirname "${BASH_SOURCE[0]}")"
  )
  for candidate in "${candidates[@]}"; do
    local resolved
    resolved="$(cd "$candidate" 2>/dev/null && pwd)" || continue
    for repo in "${REPOS[@]}"; do
      if [[ -d "$resolved/$repo/.claude" ]]; then
        echo "$resolved"
        return 0
      fi
    done
  done
  return 1
}

ROOT=""
ROOT="$(find_root)" || die "No se encontró la carpeta padre de los repos (superadmin, ecosistema, ecosistema-ms)."

info "Raíz detectada: $ROOT"
info "Verificando repos..."
for repo in "${REPOS[@]}"; do
  [[ -d "$ROOT/$repo" ]]         || die "No se encontró $ROOT/$repo"
  [[ -d "$ROOT/$repo/.claude" ]] || die "$ROOT/$repo/.claude no existe"
done
success "Repos encontrados: ${REPOS[*]}"
echo ""

# ─── documentos ──────────────────────────────────────────────────────────────

doc_05_backend() {
cat << 'MD'
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

1. **`ARG PNPM_VERSION` al inicio** — una sola fuente de verdad.
2. **`pnpm install --frozen-lockfile` siempre** — nunca `--no-frozen-lockfile` en producción.
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
MD
}

doc_06_frontend() {
cat << 'MD'
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

COPY --from=build --chown=nextjs:nodejs /app/<SERVICE_DIR>/.next/standalone ./

# .next/static y public NO están en standalone — copiarlos es obligatorio.
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
MD
}

doc_07_railway() {
cat << 'MD'
# 07 — Reglas de deploy en Railway para monorepos pnpm

> Reglas específicas de Railway que contradicen o matizan guías genéricas de Docker.
> Aplica a los tres monorepos: `superadmin`, `ecosistema`, `ecosistema-ms`.

---

## Configuración del servicio en Railway — reglas fijas

### Root Directory: siempre `/`

Railway permite configurar un "Root Directory" por servicio. **No usar esta opción.**

El build context debe ser la raíz del monorepo porque:
- El Dockerfile necesita `pnpm-workspace.yaml`, `pnpm-lock.yaml` y `tsconfig.base.json`
  que están en la raíz.
- `pnpm install` en un subdirectorio sin el workspace root falla — no puede
  resolver los packages locales (`@real/auth-client`, `@grupojl/shared-types`, etc.).
- `shamefully-hoist=true` funciona a nivel workspace, no por servicio.

**Configuración correcta en Railway:**
```
Root Directory: /                         ← raíz del monorepo, siempre
Dockerfile Path: <servicio>/Dockerfile    ← relativo a la raíz
Build Command: (vacío)                    ← el Dockerfile lo maneja todo
Start Command: (vacío)                    ← el CMD del Dockerfile lo maneja
```

### Dockerfile Path por servicio

```
# superadmin
superadmin-backend/Dockerfile
superadmin-frontend/Dockerfile

# ecosistema
realsass-sass-back/Dockerfile
realsass-ecommerce-back/Dockerfile
realsass-sass-front/Dockerfile
realsass-dashboard-front/Dockerfile
real-ecommerce-front/Dockerfile

# ecosistema-ms
chatia-backend/Dockerfile
pasarelapagos-backend/Dockerfile
notificaciones-backend/Dockerfile
analytics-backend/Dockerfile
workers-backend/Dockerfile
```

---

## Cache mounts de BuildKit en Railway

**Los cache mounts NO persisten entre builds en Railway.**

| Entorno | Cache mount persiste | Beneficio real |
|---------|---------------------|----------------|
| Docker Desktop local | ✅ sí | Builds de segundos en re-runs |
| GitHub Actions (con `actions/cache`) | ✅ sí | Builds más rápidos en CI |
| Railway | ❌ no | Sin beneficio entre builds |

Mantener los cache mounts en el Dockerfile — no hacen daño, sí ayudan en local y CI.
Para acelerar builds en Railway: asegurar que los `COPY package.json` estén ANTES
del `COPY` de source code en el stage `deps`.

---

## Variables de entorno en Railway

### Variables de runtime (backend)

Se configuran en Railway como variables del servicio, se leen en runtime:
```
DATABASE_URL, REDIS_URL, FIREBASE_PROJECT_ID, INTERNAL_API_KEY, ...
```

### Variables de build (frontend Next.js)

Las `NEXT_PUBLIC_*` **deben** estar en Railway como **build variables** además de runtime.
Si se configuran solo como runtime variables, el bundle tendrá `undefined` — el compilador
las inlineó en build time y no hay forma de corregirlo en runtime.

Ver `06-dockerfile-frontend.md` para el razonamiento completo.

---

## Health checks

- Todo backend expone `GET /health` → `200` en < 200ms.
- Railway debe apuntar el health check a `/health`, no a `/`.
- `HOSTNAME=0.0.0.0` es obligatorio en frontends Next.js standalone.

---

## Redeploy sin cambios de código

```bash
make git-empty
# o manualmente:
git commit --allow-empty -m "chore: force redeploy [$(date +%Y-%m-%d)]"
git push
```

---

## Deploy coordinado cuando cambia un package compartido

Railway no detecta automáticamente que un servicio necesita rebuild cuando
cambió un package del workspace.

```bash
git push
git commit --allow-empty -m "chore: rebuild services after shared package update"
git push
```

---

## Resumen: Railway vs. guías genéricas de Docker

| Guía genérica dice | En Railway es |
|--------------------|---------------|
| Cache mounts aceleran CI | No persisten entre builds — estructura de layers importa |
| Root Directory al subdirectorio del servicio | Siempre `/` — workspace root es necesario |
| `NEXT_PUBLIC_*` opcionales en build | Obligatorias en build — el compilador las inlinea |
| Health check a `/` | Siempre a `/health` — respuesta < 200ms |
| HOSTNAME no necesario | `HOSTNAME=0.0.0.0` obligatorio en Next.js standalone |
| Variables de entorno solo en runtime | `NEXT_PUBLIC_*` también en build |
MD
}

doc_08_testing() {
cat << 'MD'
# 08 — Norte de testing: qué testear y por qué

> Referentes: **Stripe** (tests sobre efectos de dinero), **Google** (Beyoncé Rule —
> toda invariante tiene un test que la rompe deliberadamente),
> **Vercel** (E2E pragmático — paths críticos, no cobertura decorativa).
>
> Aplica a los tres monorepos. Los ejemplos usan el stack real del ecosistema.

---

## El principio que unifica los tres referentes

**Stripe:** un test que solo prueba el happy path de un pago no protege nada.
El test que importa es el que verifica qué pasa cuando el provider falla.

**Google (Beyoncé Rule):** "if you liked it you should have put a test on it."
Toda invariante de negocio que te importa tiene un test que la rompe deliberadamente.
Si `ecosystemId` es obligatorio en toda query, hay un test que lo omite y verifica
que los datos de otro tenant no aparecen — no que "falla graciosamente".

**Vercel:** no unit tests de componentes que solo prueban que React renderiza.
E2E en los 3-5 paths que, si se rompen, el negocio para. El resto es ruido.

---

## Regla 1 — Services: testear invariantes de negocio, no implementación

### Qué NO testear

```ts
// ❌ Test que prueba la implementación — se rompe si refactorizás Prisma
it('llama a prisma.payment.create', async () => {
  await service.createPayment(input);
  expect(prisma.payment.create).toHaveBeenCalled(); // inútil
});
```

### Qué SÍ testear

```ts
// ✅ Invariante de dominio — tenant isolation (Google Beyoncé Rule)
it('nunca retorna datos de otro tenant', async () => {
  await seedPayment({ organizationId: 'org-A', ecosystemId: 'eco-1' });

  const result = await service.listPayments({
    organizationId: 'org-B', // tenant diferente
    ecosystemId:    'eco-1',
  });

  expect(result.data).toHaveLength(0); // org-B no ve los datos de org-A
});

// ✅ Invariante de negocio — fallback cuando el provider falla (Stripe)
it('activa el provider de fallback cuando el CB está abierto', async () => {
  cbService.forceOpen('mercadopago');

  const result = await service.processPayment(paymentInput);

  expect(result.provider).toBe('stripe'); // usó el fallback
  expect(result.status).toBe('SUCCESS');
});

// ✅ Invariante de audit — la acción se registra ANTES de ejecutar
it('crea AdminAction antes de suspender la org', async () => {
  const auditSpy = jest.spyOn(auditService, 'create');
  const suspendSpy = jest.spyOn(orgClient, 'suspend');

  // Forzar fallo en la ejecución
  suspendSpy.mockRejectedValueOnce(new Error('timeout'));

  await expect(service.suspendOrg(input)).rejects.toThrow();

  // El audit debe existir aunque la acción haya fallado
  expect(auditSpy).toHaveBeenCalledBefore(suspendSpy);
});
```

---

## Regla 2 — Guards: testear allowlist y tenant isolation

Los guards son el límite del sistema. Un bug acá no lo detecta el usuario — lo
detecta el atacante. Cobertura 100% sin excepción.

```ts
// ✅ AdminGuard — UID no autorizado recibe 403, no 401
it('rechaza UID fuera de la allowlist con 403', async () => {
  const ctx = mockContext({ uid: 'uid-no-autorizado' });
  await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
});

// ✅ TenantGuard — ecosystemId del token no coincide con el recurso
it('bloquea acceso cross-tenant', async () => {
  const ctx = mockContext({
    ecosystemId: 'eco-1',         // token del ecosistema 1
    params: { ecosystemId: 'eco-2' }, // intentando acceder al ecosistema 2
  });
  await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
});

// ✅ FirebaseAuthGuard — token expirado recibe 401
it('rechaza token expirado con 401', async () => {
  firebaseAdmin.verifyIdToken.mockRejectedValueOnce(
    new Error('Firebase ID token has expired')
  );
  const ctx = mockContext({ token: 'token-expirado' });
  await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
});
```

---

## Regla 3 — E2E (Playwright): solo los paths que paran el negocio

No E2E de cada feature. Solo los 3-5 flows que, si se rompen, el negocio para.
Vercel llama a esto "smoke tests" — la pregunta es "¿está encendido?", no "¿funciona todo?".

### Paths críticos por repo

**superadmin:**
```
1. Login Firebase → redirige a /dashboard (auth rota = nadie entra)
2. Dashboard con 0 alertas → muestra "Todo operativo" (render roto = ceguera operativa)
3. Suspender org → ConfirmDialog → audit trail creado (acción destructiva sin audit = violación)
```

**ecosistema (welver):**
```
1. Login → dashboard de la org (auth rota = todos los clientes bloqueados)
2. Crear producto → aparece en storefront (catalog roto = ventas paradas)
3. Checkout → orden creada → stock decrementado (flujo de dinero roto = pérdida directa)
```

**ecosistema-ms:**
```
1. Mensaje entrante → respuesta del agente IA (chatia roto = todos los chats muertos)
2. Pago iniciado → procesado por provider → webhook recibido (pasarela rota = cobros parados)
3. Job encolado → procesado → DLQ vacía (workers rotos = acumulación silenciosa)
```

### Estructura de E2E

```
e2e/
  auth.spec.ts          ← login / logout / redirect
  critical-flows.spec.ts ← los paths que paran el negocio
  # nada más — no E2E de cada página
```

---

## Cobertura mínima por capa

| Capa | Cobertura | Qué se mide |
|------|-----------|-------------|
| Guards | 100% | Todos los casos de rechazo |
| Domain services (invariantes) | 85% | Paths de error, tenant isolation, efectos de dinero |
| Integration clients / adapters | 80% | Fallbacks, CB abierto, timeout |
| Controllers HTTP | 70% | Contratos de entrada/salida (Supertest) |
| Frontend hooks | 70% | Lógica de estado, no render |
| E2E | 3-5 flows | Paths que paran el negocio |

**Lo que no se mide:** cobertura de líneas en componentes UI, getters/setters triviales,
módulos de configuración de NestJS, factories de testing.

---

## Señal de que el test está bien escrito

Un test está bien escrito si:
1. Su nombre describe **qué invariante protege**, no qué función llama.
2. Si lo borrás y el código se rompe en producción, el test lo hubiera detectado.
3. Si refactorizás la implementación sin cambiar el comportamiento, el test sigue pasando.

Un test está mal escrito si:
1. Prueba que `prisma.findMany` fue llamado.
2. Solo cubre el happy path.
3. Se rompe cuando movés código a otro archivo sin cambiar lógica.
MD
}

doc_09_observabilidad() {
cat << 'MD'
# 09 — Norte de observabilidad: qué instrumentar y por qué

> Referentes: **Honeycomb** (observabilidad real — entender cualquier estado en
> producción sin deployar código nuevo), **Datadog** (qué ve el operador en el
> dashboard), **Shopify** (trazabilidad de jobs BullMQ desde el request original).
>
> Aplica a los tres monorepos. Los ejemplos usan el stack real del ecosistema.

---

## El principio de Honeycomb (Charity Majors)

> "Observabilidad real es: dado cualquier estado que tu sistema pueda tener
> en producción, ¿podés entender qué pasó sin deployar código nuevo?"

Para este ecosistema eso significa: cuando el DLQ de workers-backend se satura,
el trace de un job fallido muestra exactamente qué paso falló, con qué payload,
en qué intento, originado por qué request HTTP, de qué organización.

Eso no lo da logging estructurado solo. Requiere trazas distribuidas con contexto
propagado entre servicios.

---

## Qué genera un span — regla por límite de servicio

Un span va en cada lugar donde el tiempo es observable y el fallo es accionable.

### Límites obligatorios

```
Request HTTP entrante         → span automático via @opentelemetry/instrumentation-http
Query Prisma                  → span automático via @opentelemetry/instrumentation-prisma
Llamada gRPC saliente         → span manual en el GrpcClient
Llamada gRPC entrante         → span automático via @grpc/grpc-js instrumentation
Job BullMQ encolado           → span manual en el service que encola
Job BullMQ procesado          → span manual en el Processor
Llamada a provider externo    → span manual en el Adapter (MercadoPago, Stripe, SendGrid, etc.)
Circuit Breaker — estado      → evento en el span del Adapter (no span propio)
Cache Redis — hit/miss        → atributo en el span del caller (no span propio)
```

### Lo que NO genera un span

```
Getters/setters internos      → ruido sin valor operativo
Logs de arranque              → van en logs estructurados, no en trazas
Health check polling          → excluir del sampler (genera >95% del tráfico sin valor)
```

---

## Atributos obligatorios en todo span de negocio

Honeycomb y Datadog son inútiles si los spans no tienen contexto para filtrar.
Todo span que toca datos de negocio lleva:

```ts
span.setAttributes({
  'tenant.ecosystem_id':    ecosystemId,    // filtro primario multi-tenant
  'tenant.organization_id': organizationId, // filtro secundario
  'service.name':           'chatia-backend', // automático via SDK
  'request.id':             correlationId,   // propagado desde el request HTTP original
});
```

El `correlationId` se genera una vez en el API Gateway o en el primer request HTTP
y se propaga en todos los spans downstream — incluidos gRPC y BullMQ jobs.

---

## Propagación de traceId en BullMQ (patrón Shopify)

Shopify documentó que un job en background sin el traceId del request que lo originó
es un job huérfano — imposible de trazar en un incidente.

```ts
// ✅ Al encolar el job — propagar el contexto de tracing
import { context, propagation } from '@opentelemetry/api';

async scheduleJob(payload: JobPayload): Promise<void> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier); // inyecta traceId en el carrier

  await this.queue.add('process-payment', {
    ...payload,
    _traceCarrier: carrier, // viaja con el job
  });
}

// ✅ Al procesar el job — restaurar el contexto
async process(job: Job<JobPayload>): Promise<void> {
  const parentCtx = propagation.extract(
    context.active(),
    job.data._traceCarrier ?? {}
  );

  return context.with(parentCtx, async () => {
    const span = tracer.startSpan('job.process-payment');
    // el span es hijo del request HTTP que originó el job
    try {
      await this.doWork(job.data);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

---

## Qué activa una alerta vs. qué es solo contexto

### Alerta (acción requerida en < 15 minutos)

```
Circuit Breaker OPEN en provider de pagos     → alerta CRÍTICA
                                                 (cobros parados)
DLQ depth > 100 jobs                          → alerta CRÍTICA
                                                 (procesamiento detenido)
Health check DOWN en cualquier servicio       → alerta CRÍTICA
Error rate > 5% en últimos 5 minutos          → alerta WARNING
Latencia P95 > 2s en endpoints de pago        → alerta WARNING
Circuit Breaker OPEN en Groq/LLM              → alerta WARNING
                                                 (chat degradado, no parado)
```

### Contexto (visible en dashboard, no alerta)

```
Cache hit/miss rate                           → métrica de eficiencia
Latencia P50 de queries Prisma                → baseline de salud
Número de jobs procesados por hora            → throughput normal
Número de requests por tenant/ecosistema      → distribución de carga
```

**Regla Datadog:** si no cambia una decisión operativa en los próximos 15 minutos,
no es una alerta — es una métrica de dashboard.

---

## Métricas custom obligatorias (Prometheus)

```ts
// Contadores — para alertas de rate
superadmin_admin_actions_total{action, ecosystem_id, status}
payment_processed_total{provider, country, status}
notification_sent_total{channel, status}
job_processed_total{queue, status}

// Histogramas — para alertas de latencia
payment_provider_duration_seconds{provider, country}
grpc_call_duration_seconds{service, method}
llm_response_duration_seconds{model}

// Gauges — para alertas de estado
circuit_breaker_state{service, key}   // 0=closed, 1=half-open, 2=open
dlq_depth{queue}                      // jobs en DLQ por cola
```

---

## Health check extendido — formato canónico

El `GET /health` básico de `@nestjs/terminus` dice "arriba/abajo".
El health extendido dice "arriba, degradado, y por qué".

```json
GET /health → {
  "status": "ok" | "degraded" | "down",
  "db":     { "status": "up", "latencyMs": 4 },
  "redis":  { "status": "up", "latencyMs": 1 },
  "circuit_breakers": {
    "mercadopago": "closed",
    "stripe":      "closed",
    "groq-llm":    "open"     ← visible en superadmin Command Center
  },
  "queues": {
    "payments":      { "waiting": 0, "dlq": 0 },
    "notifications": { "waiting": 12, "dlq": 0 }
  },
  "uptime":  3600,
  "version": "1.2.3"
}
```

`status: "degraded"` cuando el servicio funciona pero con capacidad reducida
(un CB abierto, Redis lento, queue acumulando). Railway no revierte el deploy
con degraded — pero superadmin lo muestra como alerta WARNING.

---

## Correlation ID — implementación mínima

Sin correlation ID, un error en workers-backend es invisible desde el request
HTTP de welver que lo originó.

```ts
// middleware global en main.ts de cada servicio
app.use((req, res, next) => {
  const correlationId =
    req.headers['x-correlation-id'] as string ??
    crypto.randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  // propagar al contexto de OpenTelemetry
  const span = trace.getActiveSpan();
  span?.setAttribute('request.id', correlationId);
  next();
});

// Al llamar a otro servicio (HTTP o gRPC), propagar el header
headers['x-correlation-id'] = correlationId;
```

---

## Señal de que la observabilidad está bien implementada

1. Dado un pago fallido en producción, podés llegar al span del provider en < 2 minutos
   sin grep en los logs del servidor.
2. Dado un job atascado en DLQ, podés trazar el request HTTP que lo originó.
3. Cuando el CB de Groq se abre, el operador lo ve en superadmin en < 15 segundos
   sin revisar Railway logs.
4. Podés filtrar todos los spans de una organización específica por `tenant.organization_id`.

Si alguno de estos cuatro no es posible, la observabilidad está incompleta.
MD
}

# ─── función que escribe los archivos en un repo ─────────────────────────────
write_docs() {
  local repo="$1"
  local arch_dir="$ROOT/$repo/.claude/architecture"

  info "→ $repo"
  mkdir -p "$arch_dir"

  local files=(
    "05-dockerfile-backend.md"
    "06-dockerfile-frontend.md"
    "07-railway-deploy.md"
    "08-testing-norte.md"
    "09-observabilidad-norte.md"
  )
  local funcs=(
    "doc_05_backend"
    "doc_06_frontend"
    "doc_07_railway"
    "doc_08_testing"
    "doc_09_observabilidad"
  )

  for i in 0 1 2 3 4; do
    local file="${files[$i]}"
    local func="${funcs[$i]}"
    local path="$arch_dir/$file"

    if [[ -f "$path" ]]; then
      warn "  $file ya existe — sobreescribiendo"
    fi

    "$func" > "$path"
    success "  ✓ $file"
  done
}

# ─── main ────────────────────────────────────────────────────────────────────
info "Aplicando documentos de arquitectura a los 3 monorepos..."
echo ""

for repo in "${REPOS[@]}"; do
  write_docs "$repo"
  echo ""
done

# ─── verificación final ───────────────────────────────────────────────────────
info "Verificando archivos escritos..."
echo ""
all_ok=true
DOCS=(
  "05-dockerfile-backend.md"
  "06-dockerfile-frontend.md"
  "07-railway-deploy.md"
  "08-testing-norte.md"
  "09-observabilidad-norte.md"
)
for repo in "${REPOS[@]}"; do
  for doc in "${DOCS[@]}"; do
    path="$ROOT/$repo/.claude/architecture/$doc"
    if [[ -f "$path" ]]; then
      lines=$(wc -l < "$path")
      success "  ✓ $repo/.claude/architecture/$doc (${lines}L)"
    else
      echo -e "${RED}[x.sh]${NC}  ✗ $path — NO encontrado"
      all_ok=false
    fi
  done
done

echo ""
if $all_ok; then
  success "15 archivos escritos correctamente en los 3 monorepos."
  echo ""
  info "Siguiente paso — hacer push en cada repo:"
  echo "    cd $ROOT/superadmin    && make g"
  echo "    cd $ROOT/ecosistema    && make g"
  echo "    cd $ROOT/ecosistema-ms && make g"
else
  die "Algunos archivos no se escribieron correctamente."
fi