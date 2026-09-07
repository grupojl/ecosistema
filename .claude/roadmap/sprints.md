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

### Bug corregido — DT-019

`workers-backend/src/dlq/dlq.service.ts` — `getFailedJobs()` había sido
appendeado fuera del cierre de clase `DlqService`. Corregido manualmente:
el método quedó dentro de la clase, un único `}` al final del archivo.

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
