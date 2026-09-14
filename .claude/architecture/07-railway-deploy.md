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
