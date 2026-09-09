# Backend Capa 2 — Router/Contrato Zod
# Checklist 10/10

**Score actual: 9/10 — nivel Stripe**
**Score objetivo: 10/10**
**Última actualización:** 2026-09-02

## ✅ Completado

- [ ] Todo input nuevo usa schema Zod inline junto al router
- [ ] Cero DTOs nuevos con `class-validator`
- [ ] **12 routers tRPC en sass-back** — todos los dominios cubiertos:
  auth, organizations, collaborators, configFlags, configQuotas,
  configThemes, configWebhooks, configAudit, configSecrets,
  configTemplates, affiliates + app-router central
- [ ] **4 routers tRPC en ecommerce-back** — adminCatalog, adminInventory, adminOrders, customer
- [ ] `customer.resolveStore` — publicProcedure ✅
- [ ] `customer.identify` — publicProcedure ✅
- [ ] `customer.getProducts` / `customer.getProduct` — publicProcedure ✅
- [ ] Controllers REST legacy de ecommerce-back **eliminados físicamente**
  → Solo queda `app.controller.ts` (hello world de NestJS CLI — sin rutas de negocio)
- [ ] DTOs class-validator de ecommerce-back eliminados con los controllers
- [ ] Interfaces locales en `collaborators.service.ts` sin class-validator
- [ ] `organizations-client/types/organization-access.types.ts` — verificar si fue eliminado

## ⏳ Pendiente para 10/10

### Enforcement CI (S4)
- [ ] ESLint rule `@real/no-new-class-validator`
  → Falla si alguien agrega un DTO con class-validator en código nuevo
- [ ] `dependency-cruiser` rule `no-rest-controller-in-business-module`
  → Detecta controllers REST en módulos de dominio (no en trpc/)

### Tests de contrato (S4)
- [ ] Supertest contra cada router: input inválido → error Zod tipado
- [ ] Supertest: procedure autenticado sin cookie → 401
- [ ] Supertest: procedure de owner como collaborador → 403

## Regla dura

Un DTO nuevo con `class-validator` en código post-migración es un bug de arquitectura.
Todo input nuevo = schema Zod colocado junto al router.
Un controller REST nuevo en un módulo de dominio (fuera de trpc/) = bug de arquitectura.

## Referencia de archivos

- `realsass-sass-back/src/trpc/app-router.ts` — 12 routers registrados
- `realsass-ecommerce-back/src/trpc/app-router.ts` — 4 routers registrados
- `realsass-ecommerce-back/src/trpc/routers/customer.router.ts` — procedures públicos
- `decisions/ADR-005-rest-to-trpc.md`
