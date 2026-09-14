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

Railway usa runners efímeros — cada build empieza desde cero.
El `--mount=type=cache,target=/root/.local/share/pnpm/store` existe durante
el build pero se descarta cuando el runner termina.

| Entorno | Cache mount persiste | Beneficio real |
|---------|---------------------|----------------|
| Docker Desktop local | ✅ sí | Builds de segundos en re-runs |
| GitHub Actions (con `actions/cache`) | ✅ sí | Builds más rápidos en CI |
| Railway | ❌ no | Sin beneficio entre builds |

**Regla:** mantener los cache mounts en el Dockerfile — no hacen daño, sí ayudan
en local y CI. Para acelerar builds en Railway: asegurar que los `COPY package.json`
estén ANTES del `COPY` de source code en el stage `deps`.

---

## Variables de entorno en Railway

### Variables de runtime (backend)

Se configuran en Railway como variables del servicio, se leen en runtime:
```
DATABASE_URL, REDIS_URL, FIREBASE_PROJECT_ID, INTERNAL_API_KEY, ...
```

### Variables de build (frontend Next.js)

Las `NEXT_PUBLIC_*` **deben** estar en Railway como **build variables** además de runtime.
Railway las pasa como `--build-arg` al Dockerfile durante el build.

Si se configuran solo como runtime variables, el bundle de Next.js las tendrá como
`undefined` — el compilador las inlineó en build time y no hay forma de corregirlo en runtime.

Ver `06-dockerfile-frontend.md` para el razonamiento completo.

---

## Health checks

- Todo backend expone `GET /health` → `200` en < 200ms.
- Railway debe apuntar el health check a `/health`, no a `/`.
- `HOSTNAME=0.0.0.0` es obligatorio en frontends Next.js standalone.
  Sin esto Railway no puede acceder al contenedor y el health check falla.

---

## Redeploy sin cambios de código

Para forzar un redeploy (nuevas variables de entorno, cambio en Railway, etc.):

```bash
# Disponible en todos los repos via Makefile:
make git-empty

# Equivalente manual:
git commit --allow-empty -m "chore: force redeploy [$(date +%Y-%m-%d)]"
git push
```

---

## Deploy coordinado cuando cambia un package compartido

Railway no detecta automáticamente que un servicio necesita rebuild cuando
cambió un package del workspace — solo detecta cambios en el repositorio.

Cuando se modifica un package compartido (`@grupojl/shared-types`, `@real/auth-client`,
`@ecosistema-ms/proto`, etc.):

```bash
# 1. Push del cambio del package
git push

# 2. Forzar rebuild de todos los servicios afectados
git commit --allow-empty -m "chore: rebuild services after shared package update"
git push
```

---

## Resumen: Railway vs. guías genéricas de Docker

| Guía genérica dice | En Railway es |
|--------------------|---------------|
| Cache mounts aceleran CI | No persisten entre builds — estructura de layers es lo que importa |
| Root Directory al subdirectorio del servicio | Siempre `/` — workspace root es necesario |
| `NEXT_PUBLIC_*` opcionales en build | Obligatorias en build — el compilador las inlinea |
| Health check a `/` | Siempre a `/health` — respuesta < 200ms |
| HOSTNAME no necesario | `HOSTNAME=0.0.0.0` obligatorio en Next.js standalone |
| Variables de entorno solo en runtime | `NEXT_PUBLIC_*` también en build (build variables en Railway) |
