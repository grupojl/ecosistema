# Roadmap de sprints

## S1 → S3: ✅ CERRADOS
Ver lifecycle/01-fase-desarrollo.md para detalle.

---

## Cierre Fase 1 — 2026-09-02 ✅
## Cierre Fase 2 — 2026-09-30 ✅
## Cierre Fase 3 — 2026-09-30 ✅

Ver lifecycle/02-fase-estabilizacion.md y lifecycle/03-fase-hardening.md.

---

## Sesión 2026-09-30 — Fase 4 / S4-D + S4-G + E12-02

### Archivos creados

- `realsass-dashboard-front/lib/trpc/server.ts` — createDashboardCaller() para RSC
- `realsass-sass-back/eslint.config.mjs`
- `realsass-ecommerce-back/eslint.config.mjs`
- `realsass-sass-front/eslint.config.mjs`
- `realsass-dashboard-front/eslint.config.mjs`
- `real-ecommerce-front/eslint.config.mjs`

### Archivos modificados

- `realsass-sass-back/src/health/health.controller.ts` — 3 estados (ok/degraded/down) + LATENCY_WARN_MS
- `realsass-ecommerce-back/src/health/health.controller.ts` — Redis check + 3 estados
- `realsass-ecommerce-back/src/health/health.module.ts` — RedisModule importado
- `real-ecommerce-front/app/[locale]/tienda/[slug]/layout.tsx` — revalidate=3600
- `real-ecommerce-front/app/[locale]/tienda/[slug]/productos/page.tsx` — revalidate=1800
- `realsass-dashboard-front/app/dashboard/tienda/productos/page.tsx` — prefetch real
- `realsass-dashboard-front/app/dashboard/tienda/pedidos/page.tsx` — prefetch real
- `realsass-sass-front/app/profile/page.tsx` — createSassServerCaller conectado
- `realsass-dashboard-front/features/store/hooks.ts` — onMutate optimistic + rollback

### verify-fase4-code.sh (2026-09-30)

```
Total checks : 40  |  PASS: 38  |  FAIL: 0  |  WARN: 2
```
WARN: archivos .bak acumulados (limpiar con find . -name '*.bak' -delete)

---

## S4: Tests 85% + CI + HydrationBoundary

**Estado: 🔴 ACTIVO**

| Fase | Qué | Estado |
|------|-----|--------|
| S4-A | Decisiones de degradación | ✅ 2026-09-02 |
| S4-B | conventions/state.md | ✅ done |
| S4-C | GitHub Actions 7 workflows | ✅ 2026-09-30 |
| S4-D | HydrationBoundary 4 páginas + prefetch | ✅ 2026-09-30 |
| S4-E | Tests backend | ⏳ PRÓXIMA |
| S4-F | Tests frontend | ⏳ |
| S4-G | ESLint 5 servicios | ✅ 2026-09-30 |

### S4-E — Tests backend (próxima sesión)

Orden por valor decreciente:

1. **Cross-tenant** — org A no retorna datos de org B (seguridad crítica)
2. **Domain entities** — funciones puras sin mocks (`assertValidQuantity`, `assertValidEmail`)
3. **Contracts HTTP/tRPC** — Supertest: input inválido → Zod error, sin cookie → 401
4. **Auth guards** — FirebaseAuthGuard mockeando Firebase Admin SDK

Target: ~25 tests, cobertura 85% en paths críticos.
Stack: Jest + Supertest (ya configurado con coverageThreshold: 85 en jest.config.js).
