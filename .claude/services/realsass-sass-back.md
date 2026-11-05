# realsass-sass-back

## Rol

Identidad, organizaciones, colaboradores, configuración de organización
(flags/secrets/themes/webhooks/quotas/templates), auditoría, afiliados.
Es la **única fuente de verdad** de usuarios y organizaciones en el ecosistema.

## Capas aplicadas (✅ completas)

- Capa 1: Auth/Tenant — @real/auth-server, cookies HttpOnly (ADR-004)
- Capa 2: Router/Zod — tRPC procedures con Zod
- Capa 3: Domain — domain/ en los 11 módulos
- Capa 4: Repository — repository/ en los 11 módulos, services inyectan via @Inject
- Capa 5: AppRouter tipado — SassAppRouter exportado desde @real/trpc
- Capa 6: Multi-tenant — organizationId en todos los modelos

## Módulos con domain/ + repository/

affiliate, collaborators, config-audit, config-flags, config-quotas,
config-secrets, config-templates, config-themes, config-webhooks,
organizations, users

## Módulo de referencia

No aplica — este back usa catalog/ de ecommerce-back como molde externo.
Internamente, organizations/ es el ejemplo más limpio de la arquitectura.

## routers tRPC

`src/trpc/routers/`: auth, collaborators, config-audit, config-flags,
config-quotas, config-secrets, config-themes, config-webhooks, organizations

## Sesiones y dispositivos (ADR-020) — F1+F2 ✅

Modelo `UserSession` + router `sessions.*` (`src/sessions/`, `sessions.router.ts`) + cookie `__sid`
emitida en `POST /auth/session`. Requiere aplicar la migración `20261016120000_user_sessions`. Detalle: `modules/sass-back/user-sessions.md`.

## Welver — back de municipios (2026-11-06)

sass-back es TAMBIÉN el back de Welver: no hay `welver-back` aparte (decisión del 2026-11-06; `realsass-ecommerce-back` y
`real-ecommerce-front` se eliminaron del repo). Un municipio es una `Organization` con `ecosystemId = "welver"`.
Código en `src/welver/` (módulo `WelverModule`), dominio puro en `src/welver/domain/`, routers en `src/trpc/routers/`.
Especificación: `domain/welver-domain.md` §15.

| Router tRPC | Qué hace | Quién |
|---|---|---|
| `municipio.*` | población (→ tramo), plantilla, retención | todos leen, dueño edita |
| `suscripcion.*` | paquete, facturas, ciclo activa → gracia → suspendida | dueño; `internal*` con clave interna |
| `organigrama.*`, `permisosEnte.*` | entes, vínculos transversales, plantillas, permisos por ente (heredan al subárbol) | permiso por ente / dueño |
| `conocimiento.*` | borrador → revisión → publicado, versiones, CSV | permiso por ente |
| `mandatos.*` | foto, restaurar (conserva ids), duplicar | dueño |
| `canales.*` | cuenta de Meta/TikTok por ente (solo registro y estado) | todos ven, dueño opera |
| `calidad.*`, `huecos.*` | preguntas de prueba, veredicto 95/70/100, huecos semanales | permiso por ente; `internal*` con clave interna |
| `perfiles.*`, `claves.*` (v2) | perfiles jerárquicos y claves de API, flag `welver.api` | dueño |

**Estado:** migración `20261106120000_welver_municipality` creada y validada en una base local descartable; **sin aplicar en
ningún entorno real**. 840 tests (incluye 31 de integración contra Postgres). Hasta que haya primer cliente, un municipio
SIN paquete todavía puede escribir (`SubscriptionService.assertWritable`): decisión abierta.

**Integraciones pendientes (a propósito, con su punto de entrada ya hecho):**
- Conexión real de Meta/TikTok por ente → `ChannelsService.markStatus`.
- Copia de lo publicado al índice de chatia y subida/extracción de texto de PDFs → `KnowledgeService.listPendingIndex/markIndexed`.
- Que la IA ejecute las corridas de calidad y registre huecos → `calidad.internalRecordRun`, `huecos.internalRecord`.
- Endpoint REST público de consulta (v2) → `claves.internalVerify`. Falta el límite por minuto por clave.
- Cron de vencimientos → `suscripcion.internalSync`. Cobro online (Stripe/Mercado Pago) y montos de los tramos.
- Cuotas de mensajes (`QuotaConfig` `messages`) y consumo real contra `Subscription.messageCap`.
- Front: el módulo «Tienda» ya se eliminó del dashboard (2026-11-06) y el Resumen ya lee `municipio.get` y `organigrama.list`; faltan las pantallas de Welver (organigrama, conocimiento, canales, calidad…).

## Deuda consciente

- `collaborators.service.ts` mantiene PrismaService para tx de invitación
- DTOs class-validator en controllers REST legacy (no se agrega más)
- `auth.*` router tRPC incluye `createDashboardSso` (SSO sass-front → dashboard-front). El REST `POST /auth/firebase-sso` se eliminó (era un stub).
- El acceso a una organización entre backs va por `GET /internal/access/:organizationId/:firebaseUid` con `x-internal-api-key` (reemplaza a `GET /auth/organization-access`, que exigía reenviar el Bearer del usuario).

## Bug conocido en schema

`Organization.slug` y `Organization.enabledProducts` tienen comentario
`// ← AGREGAR` — verificar migraciones aplicadas en todos los entornos.

## Región de datos (ADR-031, 2026-11-05)

Campo `Organization.dataRegion` + `src/regions/data-region.ts` (`regionDe`, `toDataRegion`, `DATA_REGIONS`). `PrismaOrganizationsRepository.create`
lo fija desde el país. Requiere aplicar la migración `20261105120000_organization_data_region`. Pendiente: tabla de políticas por país
(con el primer consumidor, retención de Welver) y exponer `dataRegion` en `OrganizationAccess` cuando otro back lo necesite.

## WhatsApp (ADR-025, 2026-10-20)

Router tRPC `whatsapp.{status,connect,disconnect}` (`src/trpc/routers/whatsapp.router.ts`, solo OWNER; conectar/desconectar con step-up) y
`src/whatsapp/whatsapp.service.ts`, que reenvía a chatia-backend (ecosistema-ms) por HTTP interno con `x-internal-api-key`.
Variables: `CHATIA_BACK_URL` y `INTERNAL_API_KEY` (mismo valor que en chatia). Sin ellas responde 503. Contrato: `contracts/whatsapp-channel.md`.
