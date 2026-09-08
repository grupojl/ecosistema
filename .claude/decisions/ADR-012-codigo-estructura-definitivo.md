# ADR-012: Código y estructura definitivo — gaps post ADR-011

**Fecha:** 2026-09-08
**Estado:** Aceptado — en ejecución
**Repo:** grupojl/welver

---

## Contexto

Post ADR-011 quedan 4 gaps confirmados en el XML:

| Gap | Evidencia | Impacto |
|-----|-----------|---------|
| `components/header.tsx` importa `@/lib/ecommerce` eliminada | Build roto | BLOQUEANTE |
| 10 componentes legacy en `catalog/` + `product/` | Código muerto, ADR-008 | Frontend Capa 4: 6→7 |
| Rate limiting ausente en `POST /auth/session` | lifecycle/02 marca ❌ | Escalón 3: 5→7 |
| GitHub Actions CI = 0 | Escalón 5 = 0/10 | Escalón 5: 0→7 |

---

## Decisión

### Fix-1: Corregir `components/header.tsx`
Eliminar import de `@/lib/ecommerce` (eliminada en ADR-008).
Header estático hasta que exista `customer.getCategories` en EcommerceAppRouter.

### Fix-2: Eliminar 10 componentes legacy (ADR-008)
0 importaciones activas confirmadas. Eliminar y limpiar tipos huérfanos.

### Fix-3: Rate limiting `POST /auth/session`
`@Throttle` con 10 req/min por IP. `@nestjs/throttler` ya instalado.

### Fix-4: GitHub Actions CI — 7 workflows
typecheck + build por servicio con path filters.

---

## Score proyectado

| Dimensión | Antes | Después |
|---|---|---|
| Frontend Capa 4 | 6/10 | 7/10 |
| Escalón 3 | 5/10 | 7/10 |
| Escalón 5 | 0/10 | 7/10 |
| **Global** | **8.5/10** | **9.2/10** |

---

## Deuda consciente restante

- HydrationBoundary (Frontend 2: 9→10) → sprint S4-D
- Tests 85% cobertura → sprint S4-E+F
- Observabilidad → excluido
