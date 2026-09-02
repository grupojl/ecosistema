# Roadmap de sprints

## S1: fusionar realsass-config-back → realsass-sass-back + adaptar tRPC

**Estado: ✅ CERRADO.**
- Schema de sass-back tiene todos los modelos de config fusionados
- TenantGuard local resuelve Prisma directo
- Módulos config-* completos con controllers/services propios
- auth.* router tRPC: ✅ me, sync, refreshClaims, selectRole

## S2: fusionar realsass-dashboard-back → realsass-ecommerce-back

**Estado: ✅ CERRADO.**
realsass-dashboard-back eliminado tras fusionarse en realsass-ecommerce-back.

## S3: implementar @real/auth-client, @real/ui + TanStack Query en fronts

**Estado: ✅ CERRADO.**

- `@real/auth-client`: ✅ completo en los 3 fronts
- `@real/ui`: ✅ 33 componentes shadcn — fuente única, components/ui/ eliminados
- `@real/auth-server`: ✅ SessionService + AuthSessionController (ADR-004)
- `@real/trpc`: ✅ SassAppRouter + EcommerceAppRouter tipados
- Auth cookies HttpOnly (ADR-004): ✅
- TanStack Query: ✅ en los 3 fronts
- Zustand: ✅ useShoppingBagStore + useSidebarStore + useUIStore
- auth.* router tRPC: ✅

## S4: tests 85% + OpenTelemetry

**Estado: 🔴 ACTIVO — 2026-09-02**
Dependencias en catalog: `@opentelemetry/sdk-node`,
`@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-prometheus`.

## Deuda técnica resuelta en sesiones 2026-08-28

**Backend sass-back — Capas 3+4 Domain/Repository (11 módulos):**
- affiliate, collaborators, config-audit, config-flags, config-quotas
- config-secrets, config-templates, config-themes, config-webhooks
- organizations, users
Cada módulo tiene: domain/*.entity.ts + repository/interface + repository/prisma-impl
Los services inyectan su repository via @Inject(TOKEN) — sin this.prisma directo.

**Frontend:**
- components/ui/ eliminados de los 3 fronts → imports a @real/ui
- lib/utils.ts centralizado → cn() desde @real/ui
- stores/ creados en los 3 fronts (Zustand UI pura)
- use-config.ts tipado completo sin any
- app/profile/config/page.tsx migrado a TanStack Query

---

## Cierre Fase 1 — welver (realsass)

**Fecha:** 2026-09-02
**Estado: ✅ FASE 1 COMPLETA**

### Qué se hizo en esta sesión

- ✅ `context/customer-context.tsx` — `identifyCustomer()` migrado a `trpc.customer.identify` (publicProcedure). 0 fetch REST de negocio en el storefront.
- ✅ `app/categoria/[categoria]/page.tsx` — redirect 308 a `/tienda/`. Eliminado consumo de `lib/ecommerce`.
- ✅ `app/products/[handle]/page.tsx` — redirect 308 a `/tienda/`. Eliminado consumo de `lib/ecommerce`.
- ✅ `lib/ecommerce/index.ts` — shim eliminado. `lib/ecommerce/utils.ts` (formatPrice) mantenido como utilidad pura.

### Criterios de Fase 1 cumplidos

- 0 fetch REST de negocio en real-ecommerce-front (excepción documentada: POST/DELETE /auth/session)
- lib/ecommerce/index.ts eliminado
- Controllers REST legacy de ecommerce-back eliminados (sesión anterior)
- customer.router.ts con todos los procedures (resolveStore, identify, getProducts, getProduct, cart.*, checkout)
- lib/store/client.ts y resolver.ts usando tRPC server caller

### Siguiente fase

**FASE 2 — Estabilización (Escalones 3, 5, 6)**
Ver: `.claude/lifecycle/02-fase-estabilizacion.md`

Prioridad inmediata:
1. GitHub Actions CI por servicio (E5-01 a E5-07)
2. Helmet + rate limiting en ambos backs (E3-01 a E3-05)
3. Logging JSON estructurado + correlationId (E6-01, E6-02)

---

## S4: Tests 85% + CI Enforcement + HydrationBoundary

**Estado: 🔴 ACTIVO — 2026-09-02**
**ADR:** `.claude/decisions/ADR-009-s4-tests-ci-hydration.md`

### Fases en orden

| Fase | Qué | Sesiones est. | Estado |
|------|-----|---------------|--------|
| S4-A | Decisiones de degradación → `architecture/00-principios.md` | 1 | ✅ 2026-09-02 |
| S4-B | `conventions/state.md` — Zustand vs TanStack | 1 | ✅ done |
| S4-C | GitHub Actions — 7 workflows + branch protection | 1-2 | ⏳ |
| S4-D | HydrationBoundary — 4 páginas prioritarias | 1-2 | ⏳ |
| S4-E | Tests backend — cross-tenant → domain → contracts → auth | 2-3 | ⏳ |
| S4-F | Tests frontend — Vitest → RTL → Playwright | 1-2 | ⏳ |
| S4-G | ESLint + dependency-cruiser rules | 1 | ⏳ |

### Meta de scores al completar S4

| Capa | Hoy | Post-S4 |
|------|-----|---------|
| Backend 1 — Auth/Tenant | 9.0 | 10.0 |
| Backend 2 — Router/Zod | 9.0 | 10.0 |
| Backend 3+4 — Domain/Repo | 9.0 | 10.0 |
| Backend 5 — AppRouter | 9.5 | 10.0 |
| Backend 6 — Multi-tenant | 9.0 | 10.0 |
| Frontend 1 — Fetch tRPC | 9.5 | 10.0 |
| Frontend 2 — TanStack Query | 9.0 | 10.0 |
| Frontend 3 — Zustand | 8.5 | 10.0 |
| Frontend 4 — Presentación | 7.0 | 8.5 (*) |
| Frontend 5 — Auth | 9.5 | 10.0 |

(*) Capa 4 llega a ~8.5/10 con tests. El 10/10 requiere `pagos-back` y APIs courier.
