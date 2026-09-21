# ADR-013 — Integración con superadmin (grupojl-control)

**Fecha:** 2026-09-19
**Estado:** Implementado ✅
**Repo:** grupojl/welver

## Qué se implementó — realsass-sass-back

### InternalModule — realsass-sass-back/src/internal/

```
src/internal/
  internal-api-key.guard.ts
  internal-organizations.controller.ts
  internal-organizations.service.ts
  internal.module.ts
  schemas.ts
```

#### Endpoints

```
GET  /internal/organizations
     ?ecosystemId&status&storeStatus&page&limit&search

GET  /internal/organizations/:id

POST /internal/organizations/:id/suspend
     body: { reason: string (min 10) }

POST /internal/organizations/:id/unsuspend
     body: { reason: string (min 10) }

POST /internal/organizations/:id/store-pause
     body: { reason: string (min 10) }

POST /internal/organizations/:id/store-resume
     body: { reason: string (min 10) }
```

### Prisma schema — dos dimensiones de control

```prisma
// Solo en model Organization — no en otros modelos
ecosystemId  String      @default("welver")
plan         String      @default("free")
status       OrgStatus   @default(ACTIVE)
suspendedAt  DateTime?
storeStatus  StoreStatus @default(ACTIVE)

enum OrgStatus {
  ACTIVE
  SUSPENDED
  BLOCKED
}

enum StoreStatus {
  ACTIVE
  PAUSED
}
```

### ecommerceEnabled

```ts
// realsass-sass-back/src/organizations/repository/prisma-organizations.repository.ts
// línea 65 — cambiado de !!ep['ecommerce'] a:
ecommerceEnabled: org.storeStatus === 'ACTIVE',
```

Consumido por realsass-ecommerce-back vía:
`GET /api/v1/auth/organization-access` → `usersService.getOrganizationAccess()`
→ `repo.getOrganizationAccess()` → retorna `{ ecommerceEnabled: boolean }`

## Decisiones de arquitectura

**Dos dimensiones de control independientes (norte Shopify Partners):**
- `status` (ACTIVE/SUSPENDED/BLOCKED) → bloquea acceso al panel via TenantGuard
- `storeStatus` (ACTIVE/PAUSED) → bloquea storefront via ecommerceEnabled: false

Un store puede estar PAUSED sin que la organización esté SUSPENDED.
Un store puede estar ACTIVE aunque la organización esté SUSPENDED.
Son completamente independientes.

**InternalApiKeyGuard:**
- Valida header `x-internal-api-key`
- Sin TenantGuard — rutas /internal/ son entre backends
- Misma clave que los MS de ecosistema-ms

## Migración Prisma

```bash
cd realsass-sass-back
pnpm prisma migrate dev --name add-superadmin-org-fields
```

Agrega a la tabla `organizations`:
- `ecosystem_id` — String default 'welver'
- `plan` — String default 'free'
- `status` — OrgStatus default ACTIVE
- `suspended_at` — DateTime nullable
- `store_status` — StoreStatus default ACTIVE
