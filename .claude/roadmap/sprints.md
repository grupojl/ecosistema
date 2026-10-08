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

## Sesión 2026-10-08 — Contratos desde `dist` + dashboard-front

Decisión: ADR-019. Detalle de pendientes en `roadmap/deuda-tecnica.md` (DT-CONTRATO-*, DT-DASH-*).

### Resultado

```
prisma generate → @real/trpc build → sass-back / ecommerce-back typecheck + build → ✅
realsass-dashboard-front typecheck + build (sin ignoreBuildErrors)                 → ✅
```

```
realsass-sass-front + real-ecommerce-front typecheck + build (sin ignoreBuildErrors) → ✅
Docker de los fronts: stage `contracts`, simulado en directorio limpio (3 fronts)    → ✅ (sin docker build real)
```

No verificado todavía: `docker build` real, lint de los fronts, prueba manual con los backs levantados
(alta de producto, stock, publicar, detalle de pedido).

### Archivos creados

- `packages/trpc/scripts/build.mjs`, `src/markets.ts`, `src/router-types.ts`, `tsconfig.core.json`
- `realsass-dashboard-front/lib/trpc/{ecommerce-client,keys}.ts`, `lib/api-client.ts` (reescrito)
- `realsass-dashboard-front/features/store/format.ts`, `features/auth/hooks/use-active-organization.ts`
- `realsass-dashboard-front/components/dashboard/{product-sheet,order-sheet}.tsx`
- `.claude/decisions/ADR-019-contratos-trpc-desde-dist.md`

- `.dockerignore` (raíz), script `contracts` en el `package.json` raíz; paso "Contratos tRPC" en los 15 workflows
- `realsass-sass-back`: `configThemes.getPublicTheme` (público, por slug)

### Tanda 3 — builds de fronts y variables de entorno

- `real-ecommerce-front`: `proxy.ts`, `robots.ts` dinámico, ARG de `SITE_URL` y de la organización.
- `realsass-sass-front`: `output: 'standalone'` (los 3 fronts arrancan `server.js` con HTTP 200 en el runtime emulado).
- `.env.example` documentado en los 5 servicios; `dev` de los fronts en puertos 3001/3002/3003.
- Pendientes nuevos: DT-ENV-01..05 (`roadmap/deuda-tecnica.md`).

### Archivos eliminados

- `components/dashboard/{accesorio-sheet,product-modal,products-table,products-filters}.tsx`
- `features/store/api.ts`

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
