# ADR-011: Plan 10/10 — Código y Estructura (sin tests ni observabilidad)

**Fecha:** 2026-09-08
**Estado:** Aceptado — en ejecución
**Repo:** grupojl/welver

---

## Contexto

Sesión del 2026-09-08: el monorepo welver está a 7.8/10 — Top 10% Latam.
El objetivo de esta sesión es cerrar todos los gaps de código y estructura
que pueden resolverse sin tests ni observabilidad, llevando el sistema al
máximo posible en esas dimensiones.

### Score de partida por dimensión de código

| Dimensión | Score partida | Causa del gap |
|-----------|--------------|---------------|
| Escalón 1 — Código | 9/10 | REST legacy ecommerce-back · lib/store fetch manual · noImplicitAny false en sass-back |
| Escalón 2 — Config | 9.5/10 | Falta .env.example · Falta validación de env al arranque |
| Escalón 3 — Infra | 6/10 | Falta rate limiting · Helmet no verificado · Solo puerto 3000 no verificado |
| Escalón 4 — DB | 8/10 | Índices organizationId no verificados · prisma migrate deploy no en Dockerfiles |
| Escalón 10 — Async | 7/10 | Redis cache keys sin scope de organizationId |

---

## Decisión

Ejecutar en una única sesión todos los cambios de código, configuración
e infraestructura que llevan welver al 10/10 en código y estructura.

### Cambios incluidos (BLOQUE 2 del x.sh)

#### E1 — Escalón 1: Código

**E1-A: Corregir noImplicitAny en sass-back**
`realsass-sass-back/tsconfig.json` tiene `"noImplicitAny": false`.
Esto anula TypeScript strict en el servicio más crítico.
Corrección: eliminar la línea (hereda `true` de tsconfig.base.json).

**E1-B: Eliminar controllers REST legacy de ecommerce-back** (ADR-005)
Los routers tRPC existen y reemplazan a estos controllers.
Mantenerlos es deuda activa: duplicación de superficie, DTOs con class-validator.
Controllers a eliminar:
- `src/catalog/catalog.controller.ts`
- `src/inventory/inventory.controller.ts` (si existe REST)
- `src/cart/cart.controller.ts`
- `src/customers/customers.controller.ts`
- `src/orders/orders.controller.ts`
- `src/store/store.controller.ts`
- `src/activity/activity.controller.ts`

**E1-C: Migrar lib/store/client.ts a tRPC server caller** (ADR-006)
`real-ecommerce-front/lib/store/client.ts` usa fetch REST manual.
Reemplazar con `createServerCaller()` del router tRPC.

**E1-D: prisma migrate deploy en Dockerfiles antes del CMD**
Ambos Dockerfiles de backend arrancan con `node dist/main` sin correr migraciones.
Corrección: agregar `npx prisma migrate deploy` en el CMD o en un script wrapper.

#### E2 — Escalón 2: Configuración

**E2-A: .env.example por servicio**
Crear archivos `.env.example` en los 2 backends con todas las variables requeridas.

**E2-B: Validación de env vars al arranque**
Agregar validación explícita al inicio de cada `main.ts`.
El servicio no debe arrancar con variables faltantes.

#### E3 — Escalón 3: Infraestructura

**E3-A: Rate limiting en endpoints sensibles**
`@nestjs/throttler` ya está instalado en sass-back (ThrottlerModule en AppModule).
Aplicar rate limiting en:
- `POST /auth/session` — máximo 10/minuto por IP
- Cualquier endpoint público de ecommerce-back

**E3-B: Helmet verificado activo**
Confirmar que helmet está en ambos `main.ts`.

#### E4 — Escalón 4: Base de datos

**E4-A: Índices @@index([organizationId]) en modelos críticos**
Verificar y agregar índices en modelos de alta frecuencia sin ellos.

#### E10 — Escalón 10: Async / Redis

**E10-A: Cache keys con scope de organizationId**
Auditar `ConfigCacheService` y `OrganizationsClientService` para asegurar
que las keys incluyen `organizationId` como prefijo.

---

## Alternativas descartadas

**"Hacer solo lo más fácil primero"** — descartado porque los cambios de
prisma migrate deploy y rate limiting son los de mayor impacto en seguridad
y correctitud. El orden debe ir de mayor a menor riesgo, no de menor a mayor esfuerzo.

**"Dejar el noImplicitAny false en sass-back"** — descartado. Es un agujero
en la seguridad de tipos del servicio que maneja identidad y permisos.
Un `any` implícito en auth o en collaborators puede silenciar un bug crítico.

---

## Consecuencias

**Al completar:**
- `tsc --noEmit` pasa sin errores con strict completo en todos los servicios
- Los backs no arrancan con variables faltantes (fail-fast al inicio)
- `POST /auth/session` tiene rate limiting — OWASP compliant
- `prisma migrate deploy` corre antes del servidor en producción
- ecommerce-back no tiene superficie REST duplicada con los routers tRPC

**Deuda consciente restante (no incluida en este ADR):**
- Tests 85% cobertura → sprint S4-E y S4-F
- GitHub Actions CI → sprint S4-C
- HydrationBoundary Server Components → sprint S4-D
- Observabilidad Prometheus/OpenTelemetry → sprint S4 (excluido por decisión)

---

## Referencias

- `decisions/ADR-005-rest-to-trpc.md` — migración REST → tRPC ecommerce-back
- `decisions/ADR-006-front-cleanup.md` — migración front a tRPC
- `decisions/ADR-004-auth-session-cookies.md` — cookies HttpOnly
- `lifecycle/01-fase-desarrollo.md` — escalón 1 detalle
- `lifecycle/02-fase-estabilizacion.md` — escalón 3 detalle
- `checklists/README.md` — historial de scores por capa
