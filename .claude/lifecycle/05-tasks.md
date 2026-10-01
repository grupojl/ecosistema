# Tasks — Cómo escalar a cada fase

Checklist ejecutable para welver/. Cada task tiene ID, qué hacer y criterio de "done".
En orden de ejecución dentro de cada fase.

---

## FASE 1 — Desarrollo (Escalones 1, 2, 4) — ✅ COMPLETA (2026-09-02)

- [x] **[E1-01..E1-16]** Controllers REST eliminados, Domain/Repo migrado, tRPC exclusivo
- [x] **[E2-01]** Secretos fuera del repo verificados
- [x] **[E2-02]** `.env.example` en los 5 servicios
- [ ] **[E2-03]** Validación env vars al arranque → diferido a S4
- [x] **[E4-01..E4-04]** Índices Prisma auditados, migrate deploy, backups y pool documentados

---

## FASE 2 — Estabilización (Escalones 3, 5, 6) — ✅ COMPLETA (2026-09-30)

- [x] **[E3-01..E3-05]** Helmet, ThrottlerGuard, CORS, puertos — ya estaban implementados
- [x] **[E5-01..E5-09]** 7 GitHub Actions workflows + dependabot + deploy.md
- [ ] **[E5-08b]** Branch protection en GitHub main — ⚠️ ACCIÓN MANUAL
- [x] **[E6-01..E6-06]** CorrelationId, Prometheus, pino, health Redis, HEALTHCHECK
- [ ] **[E6-06b]** Alertas Railway — ⚠️ ACCIÓN MANUAL

---

## FASE 3 — Hardening (Escalones 7, 8, 10) — ✅ COMPLETA (2026-09-30)

- [x] **[E7-01]** pnpm audit en CI (Fase 2)
- [x] **[E7-02]** Dependabot (Fase 2)
- [x] **[E7-03]** $queryRaw auditado — 0 vulnerabilidades
- [x] **[E7-04]** SecurityLogger con securityEvent:true en ambos backs
- [x] **[E7-05]** Runbook de incidente documentado
- [x] **[E7-06]** Rate limiting 10 req/min en POST /auth/session
- [x] **[E8-01]** Redis keys auditadas — todas con organizationId
- [x] **[E8-02]** Bull Board module creado
- [ ] **[E8-02b]** Instalar @bull-board/* — ⚠️ ACCIÓN MANUAL
- [x] **[E8-03]** Plan async órdenes documentado (ASYNC-01)
- [x] **[E10-01]** PII documentado — pii-retention.md
- [x] **[E10-02]** customer.deleteAccount — anonimización GDPR/LGPD
- [x] **[E10-03]** Logs sin PII auditados

---

## FASE 4 — Escala + S4 (código) — 🔴 PARCIAL (2026-09-30)

### Completado en sesión 2026-09-30

- [x] **[E12-02]** Health check 3 estados (ok/degraded/down) en ambos backs — LATENCY_WARN_MS=200
- [x] **[E11-05]** ISR en real-ecommerce-front — revalidate=3600 layout + revalidate=1800 productos
- [x] **[S4-D]**  HydrationBoundary con server caller real en 4 páginas:
  - dashboard-front/app/dashboard/tienda/productos/page.tsx ✅
  - dashboard-front/app/dashboard/tienda/pedidos/page.tsx ✅
  - sass-front/app/profile/page.tsx ✅
  - ecommerce-front — ISR (revalidate) aplicado ✅
- [x] **[E11-04]** Optimistic updates en TanStack Query (useUpdateProduct, useDeleteProduct)
- [x] **[S4-G]**  ESLint config canónico en los 5 servicios (no-explicit-any, no-floating-promises)
- [x] **[S4-C]**  lib/trpc/server.ts creado en dashboard-front (createDashboardCaller)

### Pendiente — requiere tests reales (S4-E / S4-F)

- [ ] **[S4-E]** Tests backend — cross-tenant → domain → contracts → auth (~25 tests)
- [ ] **[S4-F]** Tests frontend — Vitest → RTL → Playwright (~15 tests)
- [ ] **[E2-03]** Validación env vars al arranque en main.ts de cada back
- [ ] **[E11-01]** Medir latencias p50/p95/p99 — requiere tráfico real en producción
- [ ] **[E11-03]** Paginación cursor en adminCatalog.list y adminOrders.list
- [ ] **[E9-01..E9-04]** Disaster Recovery — acciones manuales en Railway
- [ ] **[E12-01]** 2+ réplicas en Railway — acción manual
- [ ] **[E12-03..E12-04]** Chaos drills — requieren producción real
- [ ] **[E13-01..E13-05]** FinOps — todo en Railway dashboard

---

## S4 — Tests 85% + CI Enforcement + HydrationBoundary

| Fase | Qué | Estado |
|------|-----|--------|
| S4-A | Decisiones de degradación | ✅ 2026-09-02 |
| S4-B | `conventions/state.md` | ✅ done |
| S4-C | GitHub Actions 7 workflows + dashboard-front server.ts | ✅ 2026-09-30 |
| S4-D | HydrationBoundary 4 páginas + prefetch real | ✅ 2026-09-30 |
| S4-E | Tests backend | ⏳ PRÓXIMA |
| S4-F | Tests frontend | ⏳ |
| S4-G | ESLint config 5 servicios | ✅ 2026-09-30 |

## Resumen de progreso

| Fase | Tasks | Completadas | % |
|------|-------|-------------|---|
| Fase 1 — Desarrollo | 19 | 18 | 95% |
| Fase 2 — Estabilización | 18 | 16 | 89% |
| Fase 3 — Hardening | 12 | 11 | 92% |
| Fase 4 + S4 (código) | 15 | 9 | 60% |
| **Total** | **64** | **54** | **84%** |

> Próxima sesión: S4-E — tests backend (cross-tenant primero)
