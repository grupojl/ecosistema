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

## Deuda consciente

- `collaborators.service.ts` mantiene PrismaService para tx de invitación
- DTOs class-validator en controllers REST legacy (no se agrega más)
- `auth.*` router tRPC incluye `createDashboardSso` (SSO sass-front → dashboard-front). El REST `POST /auth/firebase-sso` se eliminó (era un stub).
- El acceso a una organización entre backs va por `GET /internal/access/:organizationId/:firebaseUid` con `x-internal-api-key` (reemplaza a `GET /auth/organization-access`, que exigía reenviar el Bearer del usuario).

## Bug conocido en schema

`Organization.slug` y `Organization.enabledProducts` tienen comentario
`// ← AGREGAR` — verificar migraciones aplicadas en todos los entornos.

## WhatsApp (ADR-025, 2026-10-20)

Router tRPC `whatsapp.{status,connect,disconnect}` (`src/trpc/routers/whatsapp.router.ts`, solo OWNER; conectar/desconectar con step-up) y
`src/whatsapp/whatsapp.service.ts`, que reenvía a chatia-backend (ecosistema-ms) por HTTP interno con `x-internal-api-key`.
Variables: `CHATIA_BACK_URL` y `INTERNAL_API_KEY` (mismo valor que en chatia). Sin ellas responde 503. Contrato: `contracts/whatsapp-channel.md`.
