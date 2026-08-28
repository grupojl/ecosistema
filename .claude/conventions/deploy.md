# Deploy — Railway

## Principio

Cada servicio se despliega individual y aisladamente. Ver
`architecture/00-principios.md` para el detalle completo — este archivo es
solo la referencia operativa rápida.

## railway.json por servicio

Cada carpeta de servicio tiene su propio `railway.json`:
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "<carpeta-del-servicio>/Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

## Patrón de Dockerfile (multi-stage)

Todos los Dockerfiles del monorepo siguen el mismo patrón de 3 stages:

1. **deps** — copia solo los `package.json` necesarios (el del servicio +
   `packages/*` que consuma) + `pnpm-lock.yaml` + `.npmrc`, corre
   `pnpm install --frozen-lockfile`
2. **builder** — copia el código fuente completo del servicio + `packages/`,
   recibe `ARG`/`ENV` para variables `NEXT_PUBLIC_*` (fronts) o `DATABASE_URL`
   (backs, con valor dummy de build), corre el build
3. **runner** — imagen final mínima, copia solo `dist`/`.next` + `node_modules`
   + `package.json`, usuario no-root (`nestjs`/`nextjs`), `EXPOSE 3000`

## Variables de entorno — regla dura

Las `ARG`/`ENV` de cada Dockerfile son la única fuente de configuración de
ese servicio. Nunca asumir `.env` compartido entre servicios — cada uno
declara explícitamente lo que necesita en su propio Dockerfile.

Ejemplo de env vars típicas por tipo de servicio:

**Backs (NestJS):**
- `DATABASE_URL` (dummy en build, real en runtime vía Railway)
- `REDIS_ENABLED`, `REDIS_URL`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `SASS_BACK_URL` (solo en `ecommerce-back`, para `OrganizationsClientService`)
- `ALLOWED_ORIGINS` (CORS — sass-back no arranca si está vacío)
- `INTERNAL_API_KEY` (para `ApiKeyGuard` en rutas internas de config)

**Fronts (Next.js):**
- `NEXT_PUBLIC_FIREBASE_*` (API key, auth domain, project id, etc.)
- `NEXT_PUBLIC_*_BACK_URL` / `NEXT_PUBLIC_*_API_URL` (URLs de los backs consumidos)
- `NEXT_PUBLIC_*_FRONT_URL` (para SSO entre fronts)

## nixpacks.toml (alternativa a Dockerfile detectada en fronts)

Los 3 fronts también tienen `nixpacks.toml` con fases `setup` → `install` →
`build` → `postbuild` → `start`. El `postbuild` copia `.next/static` y
`public/` dentro de `.next/standalone` — necesario porque usan
`output: standalone` de Next.js ahí (a diferencia de `sass-front` y
`dashboard-front`, que lo deshabilitan por el tema de `shamefully-hoist`,
ver `conventions/entorno.md`).

**Verificar cuál de los dos (Dockerfile vs nixpacks) es el que Railway usa
efectivamente en cada servicio antes de asumir uno** — puede haber
inconsistencia si ambos existen para el mismo servicio.

## docker-compose.yml (solo desarrollo local)

Levanta `postgres-back` (5432), `postgres-ecommerce` (5433) y `redis` (6379)
para desarrollo local. No se usa en producción — Railway provisiona sus
propias instancias gestionadas.
