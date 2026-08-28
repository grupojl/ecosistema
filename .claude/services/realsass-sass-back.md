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

## Deuda consciente

- `collaborators.service.ts` mantiene PrismaService para tx de invitación
- DTOs class-validator en controllers REST legacy (no se agrega más)
- `auth.*` router tRPC no incluye firebase-sso ni organization-access (REST back-to-back)

## Bug conocido en schema

`Organization.slug` y `Organization.enabledProducts` tienen comentario
`// ← AGREGAR` — verificar migraciones aplicadas en todos los entornos.
