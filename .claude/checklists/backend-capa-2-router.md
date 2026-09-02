# Backend Capa 2 — Router/Contrato Zod
# Checklist 10/10

**Score actual: 7/10 — nivel Rappi/Mercado Libre**
**Score objetivo: 10/10 — nivel Stripe**

## ✅ Completado

- [x] Todo input nuevo usa schema Zod inline junto al router
- [x] Cero DTOs nuevos con `class-validator`
- [x] 11 routers tRPC en sass-back — todos los dominios cubiertos
- [x] 4 routers tRPC en ecommerce-back (adminCatalog, adminInventory, adminOrders, customer)

## ⏳ Pendiente para 10/10

### Eliminar REST legacy ecommerce-back (ADR-005 — BLOQUEANTE)
- [ ] `catalog.controller.ts` → ya existe `adminCatalog.*` tRPC
- [ ] `inventory.controller.ts` → ya existe `adminInventory.*` tRPC
- [ ] `orders.controller.ts` + `checkout.controller.ts` → ya existe `adminOrders.*` tRPC
- [ ] `cart.controller.ts` → ya existe `customer.*` tRPC
- [ ] `customers.controller.ts` → agregar `customer.identify` procedure
- [ ] `store.controller.ts` → agregar `customer.resolveStore` procedure
- [ ] `public-catalog.controller.ts` → agregar procedures en `customer.*`
- [ ] `activity.controller.ts` → evaluar si tiene consumidor activo

### Después de eliminar controllers
- [ ] Eliminar DTOs class-validator de ecommerce-back
- [ ] Eliminar `organizations-client/types/organization-access.types.ts` (duplicado de `@real/auth-server`)

### Enforcement CI (S4)
- [ ] ESLint rule `@real/no-new-class-validator`
  → Falla si alguien agrega un DTO con class-validator en código nuevo

## Regla dura

Un DTO nuevo con `class-validator` en código post-migración es un bug de arquitectura.
Todo input nuevo = schema Zod colocado junto al router.

## Referencia de archivos

- `realsass-ecommerce-back/src/trpc/routers/` — routers existentes
- `realsass-ecommerce-back/src/*/` — controllers a eliminar
- `decisions/ADR-005-rest-to-trpc.md`
