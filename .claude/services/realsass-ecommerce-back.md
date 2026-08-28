# realsass-ecommerce-back

## Rol

Catálogo, stock, carrito, órdenes, clientes del storefront. Sirve tanto al
dashboard de dueños (admin) como al storefront público (customer).

## Le corresponde

- `Category`, `Product`, `ProductVariant`, `InventoryItem`
- `StoreCustomer`, `CustomerAddress`, `CustomerActivityEvent`
- `Cart`, `CartItem`, `Order`, `OrderItem`, `OrderStatusEvent`
- Resolver slug → `StoreInfo` para el storefront multi-tenant
  (`GET /ecommerce/public/by-slug/:slug`)
- Checkout con reserva de stock atómica dentro de transacción Prisma
  (`InventoryService.reserveWithinTransaction` usa `$executeRaw` con
  condición WHERE columna-vs-columna para evitar overselling en concurrencia)

## NO le corresponde

- Identidad de usuarios, organizaciones, colaboradores (eso es `sass-back`)
- Resolver `organizationId` desde disco/memoria — siempre vía
  `OrganizationsClientService` (HTTP + Redis cache) hacia `sass-back`

## Auth/Tenant

**No tiene tabla `Organization` propia** — no usa Prisma para resolver tenant.
`TenantGuard` (de `@real/auth-server`) llama
`OrganizationsClientService.getAccess(token, uid, orgId)`, que hace `fetch`
real a `SASS_BACK_URL` con cache Redis de TTL corto. Ver
`contracts/organization-access.md` para el contrato completo.

## Dos contextos tRPC independientes (ver `src/trpc/trpc.ts`)

- **AdminContext**: `uid`, `organizationId`, `role` ('OWNER'|'COLLABORATOR'),
  `userId` — para el dashboard de dueños/colaboradores
- **CustomerContext**: `customerId`, `organizationId` — para clientes del
  storefront público, sin Firebase, identificados por header `x-customer-id`
  seteado tras `POST /customers/identify`

## Pendiente explícito (TODO en código)

`OrdersService.checkout()` — comentario: "TODO: cuando se conecte
pasarela-pagos, acá se crea el PaymentIntent... Hoy la orden queda en
PENDING_PAYMENT." → `pagos-back` todavía no existe como servicio.

## Módulos principales

`catalog`, `inventory`, `cart`, `orders` (+ `checkout` controller separado,
público), `customers`, `activity`, `store`, `organizations-client`, `redis`,
`prisma`, `trpc`.

## 🎯 Módulo de referencia: catalog (capas 1-4 aplicadas)

`src/catalog/` es el MOLDE VIVO de la arquitectura objetivo. Cualquier
refactor de otro módulo (`orders`, `inventory`, `cart`, `customers`) debe
seguir esta misma estructura:
catalog/
├── domain/
│ ├── product.entity.ts # reglas puras — sin NestJS, sin Prisma
│ ├── product.errors.ts # DomainError tipados
│ └── product.entity.spec.ts # test SIN mocks (funciones puras)
├── repository/
│ ├── catalog.repository.interface.ts # puerto (contrato)
│ └── prisma-catalog.repository.ts # adaptador (único lugar con Prisma)
├── catalog.service.ts # application — orquesta domain + repository
├── catalog.service.spec.ts # test mockeando el Repository, no Prisma
├── catalog.module.ts # bindea CATALOG_REPOSITORY → PrismaCatalogRepository
├── catalog.controller.ts # admin (sin cambios de este refactor)
└── public-catalog.controller.ts # storefront público (sin cambios)

**Principio de inyección:** el Service depende del token
`CATALOG_REPOSITORY` (Symbol), nunca de `PrismaCatalogRepository`
directamente. El binding vive solo en `catalog.module.ts`.

**Qué NO se tocó:** el schema de Prisma es el mismo, los controllers son
los mismos (siguen recibiendo el mismo DTO), el contrato HTTP externo no
cambió. Este refactor es 100% interno — invisible para los consumidores.
