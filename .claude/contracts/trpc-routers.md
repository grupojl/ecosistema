# Contrato: routers tRPC por back

## realsass-sass-back — AppRouter

Namespaces (ver `src/trpc/app-router.ts`):
- `organizations.*`
- `collaborators.*`
- `configFlags.*`
- `configQuotas.*`
- `configThemes.*`
- `configWebhooks.*`
- `configAudit.*`
- `configSecrets.*`
- `auth.*` ✅ COMPLETO — `src/trpc/routers/auth.router.ts`
  - `auth.me`            → perfil completo (authProcedure query)
  - `auth.sync`          → upsert + claims tras login (authProcedure mutation)
  - `auth.refreshClaims` → reemite claims al cambiar de org (authProcedure mutation)
  - `auth.selectRole`    → selecciona org/rol activo (authProcedure mutation)

Procedures base (`src/trpc/trpc.ts`):
- `publicProcedure`  — sin auth
- `authProcedure`    — requiere `uid`
- `tenantProcedure`  — requiere `uid` + `organizationId` + `role`
- `ownerProcedure`   — requiere además `role === 'OWNER'`

## realsass-ecommerce-back — EcommerceAppRouter

Namespaces (ver `src/trpc/app-router.ts`):
- `adminCatalog.*`   — requiere OWNER/COLLABORATOR
- `adminInventory.*` — requiere OWNER/COLLABORATOR
- `adminOrders.*`    — requiere OWNER/COLLABORATOR
- `customer.*`       — cliente del storefront (sin Firebase)

Procedures (`src/trpc/trpc.ts`):
- `publicProcedure`
- `adminProcedure`     (OWNER o COLLABORATOR)
- `ownerOnlyProcedure` (solo OWNER)
- `customerProcedure`  (requiere `customerId` + `organizationId` de headers)

## Regla dura

`@real/trpc` exporta el tipo real (`SassAppRouter`, `EcommerceAppRouter`),
nunca `AnyRouter`. Capa 5 completa — sin casts `as any`.
