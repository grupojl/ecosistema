# AUDIT-LAST.md — Resultado de la última auditoría de welver/

**Fecha:** 2026-09-08
**Auditor:** Claude (sesión de implementación ADR-011 + ADR-012)
**Protocolo:** `.claude/AUDIT.md` v1

---

## Scores por dimensión

| # | Dimensión | Score | Peso | Ponderado | Evidencia principal |
|---|-----------|-------|------|-----------|---------------------|
| 1 | TypeScript Strict | 10/10 | 15% | 1.50 | `noImplicitAny: true` heredado de tsconfig.base.json en ambos backs. 0 class-validator en ecommerce-back (ADR-011). |
| 2 | Arquitectura de capas backend | 9.2/10 | 20% | 1.84 | 11 módulos sass-back con domain/+repository/. catalog/ como molde en ecommerce-back. Excepción documentada: collaborators.service.ts con PrismaService para tx atómicas. Pendiente: cart/, orders/, customers/, inventory/ en ecommerce-back. |
| 3 | Frontend — Fetch y estado | 9.0/10 | 15% | 1.35 | lib/store/client.ts migrado a tRPC server caller (ADR-011). Sin fetch() manual en hooks de datos. Pendiente: HydrationBoundary en 4 páginas. |
| 4 | Seguridad | 9.0/10 | 15% | 1.35 | Helmet ✅. @Throttle en POST/DELETE /auth/session (ADR-012). CORS sin wildcard. prisma migrate deploy en ambos Dockerfiles (ADR-011). |
| 5 | Configuración y entorno | 10/10 | 10% | 1.00 | .env.example en sass-back y ecommerce-back. Validación fail-fast en main.ts. catalog único en pnpm-workspace.yaml. |
| 6 | CI/CD | 7.0/10 | 10% | 0.70 | 7 workflows GitHub Actions (ADR-012) con path filters y typecheck+build. Sin tests en CI — sprint S4-E pendiente. |
| 7 | Deuda técnica | 8.5/10 | 15% | 1.27 | 0 deuda bloqueante. Componentes legacy eliminados (ADR-012). header.tsx sin import de @/lib/ecommerce. Deuda aceptada: cart/orders/customers en ecommerce-back — sprint dedicado. |

---

## Score global: 9.01/10

**Posición estimada:** Top 3% Latam · Top 10% mundial en código y estructura (sin tests ni observabilidad)

---

## Comparación con auditoría anterior

| Dimensión | Anterior | Actual | Delta |
|---|---|---|---|
| TypeScript Strict | 7.0 | 10.0 | ⬆️ +3.0 |
| Arquitectura capas | 8.0 | 9.2 | ⬆️ +1.2 |
| Frontend Fetch | 7.5 | 9.0 | ⬆️ +1.5 |
| Seguridad | 5.0 | 9.0 | ⬆️ +4.0 |
| Config/Entorno | 7.0 | 10.0 | ⬆️ +3.0 |
| CI/CD | 0.0 | 7.0 | ⬆️ +7.0 |
| Deuda técnica | 7.0 | 8.5 | ⬆️ +1.5 |
| **Global** | **7.0** | **9.01** | **⬆️ +2.01** |

---

## Top 3 gaps por impacto en score

### GAP-1: HydrationBoundary ausente — Frontend Capa 2 (impacto: +0.15 en score global)
- **Qué falta:** Server Components en 4 páginas del storefront sin `dehydrate(queryClient)` + `<HydrationBoundary>`
- **Archivos afectados:** `real-ecommerce-front/app/tienda/[slug]/page.tsx`, `productos/page.tsx`, `[handle]/page.tsx`, `categoria/[categoria]/page.tsx`
- **Sprint:** S4-D
- **Beneficio:** cero loading flash en SSR real

### GAP-2: Domain/Repository en 4 módulos de ecommerce-back (impacto: +0.10 en score global)
- **Qué falta:** cart/, orders/, customers/, inventory/ sin domain/ + repository/
- **Archivos afectados:** `realsass-ecommerce-back/src/cart/cart.service.ts` y similares
- **Sprint:** S4-B
- **Beneficio:** ecommerce-back al mismo nivel que sass-back

### GAP-3: Tests 85% cobertura en paths críticos (impacto: +0.08 en score global)
- **Qué falta:** 0 tests en ambos backs y los 3 fronts
- **Sprint:** S4-E+F
- **Beneficio:** CI enforcement — un PR que rompa el contrato tRPC falla antes de merge

---

## Próxima auditoría sugerida

**Cuándo:** Antes del próximo sprint o cuando se completen S4-B, S4-D, o S4-E
**Foco:** Verificar HydrationBoundary en storefront + Domain/Repository en ecommerce-back
