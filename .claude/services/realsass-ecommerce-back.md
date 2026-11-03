# realsass-ecommerce-back

## Rol

Catálogo, stock, carrito, órdenes, clientes del storefront.
Sirve al dashboard (admin) y al storefront (customer) — ambos vía tRPC.

## Principio de comunicación

**Todo consumo interno es tRPC.** No expone REST para fronts ni para otros backs.
REST solo para `GET /health` (Railway) y futuros webhooks externos.

## Le corresponde

- `Category`, `Product`, `ProductVariant`, `InventoryItem`
- `StoreCustomer`, `CustomerAddress`, `CustomerActivityEvent`
- `Cart`, `CartItem`, `Order`, `OrderItem`, `OrderStatusEvent`
- Resolver slug → `StoreInfo` (vía `customer.resolveStore` tRPC — pendiente migrar desde REST)
- Checkout con reserva de stock atómica dentro de transacción Prisma

## NO le corresponde

- Identidad de usuarios, organizaciones, colaboradores (`sass-back`)
- Resolver `organizationId` desde disco/memoria — siempre vía
  `OrganizationsClientService` (tRPC HTTP + Redis cache) hacia `sass-back`

## Auth/Tenant

No tiene tabla `Organization` propia. Resuelve tenant así:
- Admin (dashboard): `FirebaseAuthGuard` + `TenantGuard` (token Firebase + `x-organization-id`)
- Customer (storefront): `customerProcedure` — Bearer de Firebase con email verificado + `x-organization-id`; el customerId se deriva (ADR-021, `customers/resolve-customer.ts`)

## Routers tRPC (EcommerceAppRouter)

- `adminCatalog.*` — OWNER/COLLABORATOR — CRUD productos y categorías
- `adminInventory.*` — OWNER/COLLABORATOR — stock
- `adminOrders.*` — OWNER/COLLABORATOR — órdenes
- `customer.*` — CustomerContext — carrito, órdenes, perfil, catálogo público

## Pendiente (ADR-005 — migración REST → tRPC)

Controllers REST a eliminar:
- `catalog.controller.ts` → `adminCatalog.*` tRPC (ya existe)
- `inventory.controller.ts` → `adminInventory.*` tRPC (ya existe)
- `orders.controller.ts` / `checkout.controller.ts` → `adminOrders.*` tRPC (ya existe)
- `cart.controller.ts` → `customer.*` tRPC (ya existe)
- `customers.controller.ts` → `customer.identify` tRPC (pendiente agregar)
- `store.controller.ts` → `customer.resolveStore` tRPC (pendiente agregar)
- `public-catalog.controller.ts` → procedures en `customer.*` (pendiente agregar)
- `activity.controller.ts` → evaluar si tiene consumidor activo

## Idempotencia de pagos (DT-IDEM-3, 2026-11-03)

- `src/idempotency/` — `IdempotencyService` + tabla `idempotency_keys` (tenant, RLS). `src/orders/payment-confirmation.service.ts` — `confirm(org, orderId, {eventId, paymentIntentId, amountCents})`. Sin ruta todavía (a la espera del contrato con `pagos-back`).
- Tests contra Postgres real: `checkout.concurrency.integration.spec.ts`, `payment-confirmation.integration.spec.ts`, `prisma/cross-tenant.spec.ts`.

## Deuda consciente

- `checkout.controller.ts` — `paymentIntentId` en null hasta que exista `pagos-back`
- DTOs con class-validator en controllers REST legacy (no agregar más)
- `organizations-client/types/organization-access.types.ts` — duplicado de `@real/auth-server`, eliminar con los controllers
