# ADR-012 — Domain/Repository completo en ecommerce-back (2026-09-17)

**Fecha:** 2026-09-17
**Estado:** Aceptado — implementado
**Repo:** grupojl/welver

## Contexto

Los 4 módulos de `realsass-ecommerce-back` (cart, orders, customers, inventory)
usaban `PrismaService` directamente en el service, violando la regla de
Domain/Repository del ADR-010. Solo `catalog/` tenía el molde completo.

El checklist backend-capas-3-4 marcaba estos 4 módulos como `- [ ]` pendientes.

## Decisión

Migrar los 4 services para inyectar `IRepository` via `@Inject(TOKEN)`.
Mismas excepciones documentadas que en los otros monorepos:

| Service | PrismaService directo | Razón |
|---------|----------------------|-------|
| `cart.service.ts` | ❌ eliminado | — |
| `orders.service.ts` | ✅ excepción | `checkout()` usa $transaction multi-tabla |
| `customers.service.ts` | ❌ eliminado | — |
| `inventory.service.ts` | ✅ excepción | `reserveWithinTransaction()` usa $executeRaw atómico en la misma tx que checkout |

## Verificación

```bash
# Debe retornar 0 líneas (excl. excepciones y archivos de infraestructura)
grep -rn "PrismaService" realsass-ecommerce-back/src --include="*.service.ts" \
  | grep -v "catalog\|prisma.service\|prisma.module\|orders.service\|inventory.service"
```

## Impacto en score

Backend 3+4 — Domain/Repository: 8.5/10 → **9.5/10**
Promedio general welver: 8.8/10 → **9.4/10**

## Pendiente — Scope S5

Cuando `IOrdersRepository` y `IInventoryRepository` soporten
`tx?: Prisma.TransactionClient`, `checkout()` y `reserveWithinTransaction()`
migrarán completamente. Hoy esta es una excepción consciente y documentada.
