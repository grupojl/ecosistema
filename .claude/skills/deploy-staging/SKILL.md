---
name: deploy-staging
description: Usar al preparar, validar o desplegar el ecosistema en Railway (staging o primer producción), al hacer docker build de los 5 servicios, o al revisar variables de entorno antes de un deploy. NUNCA despliega ni hace push sin confirmación explícita del usuario.
---

# Deploy a Railway (staging)

> ⚠️ **Skill sin probar de punta a punta**: todavía no existe un staging real ni se hizo `docker build` de los 5 servicios
> (DT-Q-11, DT-Q-07). Los pasos salen de `conventions/deploy.md`, `architecture/07-railway-deploy.md` y los fallos del primer
> deploy (2026-10-08). Al ejecutarla por primera vez, anotar lo que falle y corregir esta skill.

## Guardas

- **Push, deploy, cambios de variables en Railway y migraciones sobre bases remotas = acciones externas: pedir confirmación cada vez.**
  Una aprobación anterior no cubre la siguiente.
- Antes de cualquier migración remota: backup de la base y revisar el SQL (skill `nueva-migracion`). El back corre `prisma migrate deploy` al arrancar.
- No imprimir ni commitear valores de secretos; verificar solo que **existen**.

## 1. Pre-flight local

1. Skill `antes-de-mergear` completa (incluye integración).
2. `docker build` de los 5 servicios con contexto = raíz del monorepo:
   ```bash
   docker build -f realsass-sass-back/Dockerfile -t eco/sass-back .
   docker build -f realsass-ecommerce-back/Dockerfile -t eco/ecommerce-back .
   docker build -f realsass-sass-front/Dockerfile -t eco/sass-front .      # + --build-arg NEXT_PUBLIC_*
   docker build -f realsass-dashboard-front/Dockerfile -t eco/dashboard-front .
   docker build -f real-ecommerce-front/Dockerfile -t eco/ecommerce-front .
   ```
   (Docker está en el entorno Linux/WSL del usuario; si no está en esta terminal, pedirle que lo corra y pegue la salida.)
3. `bash scripts/audit/run.sh deploy` (G1-G9).

## 2. Reglas de Railway (aprendidas, no repetir)

- Root Directory `/`, Dockerfile Path `<servicio>/Dockerfile`, Build/Start Command vacíos.
- **Sin** `RUN --mount=type=cache` (Railway lo rechaza: falta el prefijo `s/<id>`).
- `ARG PNPM_VERSION` **re-declarado dentro de cada stage** (si no, corepack baja pnpm 12 y rompe).
- `NEXT_PUBLIC_*` van como **build variables** además de runtime; si no, el bundle queda `undefined`.
- `HOSTNAME=0.0.0.0` en fronts standalone; health check de backs en `GET /health`.
- `node_modules` vive en `/app/node_modules`; los `.sh` se invocan con `sh` (el bit ejecutable no viaja).
- Si cambia un package compartido, Railway no rebuilda solo: commit vacío (`make git-empty`) — **con confirmación**.

## 3. Variables (verificar que existen, por servicio)

| Servicio | Imprescindibles |
|---|---|
| sass-back | `DATABASE_URL`, `REDIS_URL`, `ALLOWED_ORIGINS`, `INTERNAL_API_KEY`, credenciales Firebase Admin |
| ecommerce-back | `DATABASE_URL`, `REDIS_URL`, `SASS_BACK_URL`, `ALLOWED_ORIGINS`, `INTERNAL_API_KEY`, **`CUSTOMER_SESSION_SECRET`** (`openssl rand -hex 32`), `COOKIE_DOMAIN` compartido con el storefront |
| fronts | `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_*_BACK_URL` / `*_API_URL`, `SITE_URL` (storefront), `ORGANIZATION_ID` |

Sin `ALLOWED_ORIGINS`, `INTERNAL_API_KEY` o `CUSTOMER_SESSION_SECRET` el back **no arranca** (por diseño). Opcional: `OTEL_EXPORTER_OTLP_ENDPOINT`.
Contrastar contra el `.env.example` de cada servicio. Los carritos en curso se pierden al activar la sesión firmada (DT-Q-10).

## 4. Orden y humo

Orden: sass-back → ecommerce-back (depende de `SASS_BACK_URL`) → fronts. Después de cada uno:
`GET /health` = 200; tRPC responde en `/api/v1/trpc` (no `/api/v1/api/v1/trpc`); login real; crear producto; checkout de prueba.

## 5. Rollback

Redeploy del commit anterior desde Railway. Si hubo migración, **no revertir con SQL a mano**: decidirlo con el usuario (migración aditiva ⇒ suele bastar el rollback de código).

## Verificación final

- [ ] 5 builds de Docker OK · auditoría `deploy` sin hallazgos
- [ ] Variables presentes por servicio (sin exponer valores)
- [ ] `/health` 200 y flujo de humo OK en staging
- [ ] Resultado y desvíos anotados en `roadmap/deuda-tecnica.md`

## Mantenimiento

Depende de `conventions/deploy.md`, `architecture/05-07`, `infrastructure/environments.md`, ADR-023. Actualizar tras cada incidente de deploy.
