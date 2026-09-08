# Sprints — ecosistema-ms

**Última actualización:** 2026-09-07

## Estado de fases

| Fase | Descripción | Estado |
|------|-------------|--------|
| FASE 0 | Estructura base .claude/ | ✅ COMPLETO |
| FASE 1 | Carpetas bloqueantes/dinámicas | ✅ COMPLETO |
| FASE 2 | ADR-001: DTOs → Zod | ✅ COMPLETO — 0 class-validator residuales |
| FASE 3 | Contratos gRPC documentados | ✅ COMPLETO |
| FASE 4 | Domain/Repository MOLDE VIVO | ✅ COMPLETO |
| FASE 5 | Multi-tenant — auditoría queries | ✅ COMPLETO |
| FASE 7 | Internal API para superadmin (ADR-008) | ✅ COMPLETO |
| FASE 6 | Build limpio + Railway | 🔴 PRÓXIMA |

---

## Logros FASE 7 — Internal API superadmin (2026-09-07)

### Archivos creados

| Archivo | Servicio |
|---------|---------|
| `src/common/guards/internal-api-key.guard.ts` | los 5 servicios |
| `src/health/health-extended.controller.ts` | los 5 servicios |
| `src/internal/internal-conversations.controller.ts` | chatia-backend |
| `src/internal/internal-payments.controller.ts` | pasarelapagos-backend |
| `src/internal/internal-metrics.controller.ts` | analytics-backend |
| `src/internal/internal-dlq.controller.ts` | workers-backend |
| `src/internal/internal.module.ts` | chatia, pasarela, analytics, workers |
| `src/common/pipes/zod-validation.pipe.ts` | pasarela, analytics, workers (si no existía) |

### Módulos actualizados

<<<<<<< HEAD
**Estado: 🔴 ACTIVO — 2026-09-02**
Dependencias en catalog: `@opentelemetry/sdk-node`,
`@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-prometheus`.
=======
| Archivo | Cambio |
|---------|--------|
| `chatia/src/health/health.module.ts` | +HealthExtendedController |
| `pasarela/src/health/health.module.ts` | +HealthExtendedController +CircuitBreakerService |
| `notificaciones/src/health/health.module.ts` | +HealthExtendedController +CircuitBreakerService |
| `analytics/src/health/health.module.ts` | +HealthExtendedController |
| `workers/src/health/health.module.ts` | +HealthExtendedController +DlqModule +CircuitBreakerService |
| `pasarela/src/app.module.ts` | +InternalModule |
| `analytics/src/app.module.ts` | +InternalModule |
| `workers/src/app.module.ts` | +InternalModule |
>>>>>>> efe7f06e2d3e68c2c0a774de38ce5f87f5a5b862

### Bug corregido — DT-019

`workers-backend/src/dlq/dlq.service.ts` — `getFailedJobs()` había sido
appendeado fuera del cierre de clase `DlqService`. Corregido manualmente:
el método quedó dentro de la clase, un único `}` al final del archivo.

<<<<<<< HEAD
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
=======
### Endpoints expuestos

| Endpoint | Servicio | Fase superadmin |
|----------|---------|-----------------|
| GET /api/v1/health/extended | los 5 | Fase 1 |
| GET /internal/conversations/escalated | chatia | Fase 2 |
| GET /internal/conversations/stats | chatia | Fase 2 |
| GET /internal/payments | pasarela | Fase 2 |
| GET /internal/payments/:id | pasarela | Fase 3 |
| POST /internal/payments/:id/retry | pasarela | Fase 3 |
| GET /internal/metrics/summary | analytics | Fase 3 |
| GET /internal/jobs/dlq | workers | Fase 3 |
| POST /internal/jobs/dlq/:id/retry | workers | Fase 3 |

---

## FASE 6 — Build limpio + Railway (PRÓXIMA)

### Paso 1 — Build limpio

```bash
pnpm -r build
# Criterio de done: 0 errores TypeScript en los 5 servicios
```

### Paso 2 — Variables Railway

En cada uno de los 5 servicios Railway:
```
INTERNAL_API_KEY=<openssl rand -hex 32>   # misma clave en todos
```

En superadmin (grupojl-control-backend) Railway:
```
CHATIA_INTERNAL_URL=http://chatia-backend.railway.internal:3000
PASARELA_INTERNAL_URL=http://pasarelapagos-backend.railway.internal:3001
NOTIFICACIONES_INTERNAL_URL=http://notificaciones-backend.railway.internal:3002
ANALYTICS_INTERNAL_URL=http://analytics-backend.railway.internal:3003
WORKERS_INTERNAL_URL=http://workers-backend.railway.internal:3004
INTERNAL_API_KEY=<misma-clave>
```

### Paso 3 — Verificar conectividad (una URL a la vez)

```bash
# Sin auth — debe retornar JSON con status ok/degraded/down
curl https://chatia-backend.railway.app/api/v1/health/extended

# Con auth — debe retornar datos reales
curl -H "x-internal-api-key: $INTERNAL_API_KEY" \
  "https://chatia-backend.railway.app/internal/conversations/escalated?ecosystemId=welver"
```

### Criterio de done FASE 6

- [ ] `pnpm -r build` → 0 errores TypeScript
- [ ] Los 5 servicios con `INTERNAL_API_KEY` en Railway
- [ ] Superadmin con las 6 URLs configuradas
- [ ] DemoBadge desaparece en Command Center del superadmin
>>>>>>> efe7f06e2d3e68c2c0a774de38ce5f87f5a5b862
