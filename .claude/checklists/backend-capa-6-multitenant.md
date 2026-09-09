# Backend Capa 6 — Multi-tenant como invariante transversal
# Checklist 10/10

**Score actual: 9/10 — nivel Shopify multi-tenant**
**Score objetivo: 10/10**

## ✅ Completado

- [ ] Todo modelo con datos de negocio lleva `organizationId`
- [ ] Todo repository method recibe `organizationId` como parámetro obligatorio
- [ ] TenantContext resuelto una sola vez en Capa 1 — no en cada service
- [ ] ecommerce-back nunca resuelve tenant desde disco — siempre HTTP + Redis cache
- [ ] Permisos JSONB en `Collaborator` — extensible sin migraciones (ADR-001)

## ⏳ Pendiente para 10/10

### Enforcement CI (S4)
- [ ] ESLint rule `@real/no-unscoped-prisma-query`
  → Detecta `this.prisma.model.findMany()` sin `organizationId` en el `where`
  → Un query sin scope es una filtración de datos entre tenants

### Tests de seguridad (S4)
- [ ] Test: request con `organizationId` de otra org → 403 o resultado vacío
- [ ] Test: collaborador sin permiso accediendo a recurso de owner → 403
- [ ] Test: query cross-tenant devuelve 0 resultados (no error, no data de otro tenant)

## Regla dura

Un query sin `organizationId` en el `where` es un bug crítico de seguridad,
no un code smell. Se bloquea el PR — no se mergea con ticket de deuda.

## Referencia

- `decisions/ADR-001-permisos-jsonb.md`
- `contracts/tenant-context.md`
- `contracts/organization-access.md`
