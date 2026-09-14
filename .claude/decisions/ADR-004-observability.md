# ADR-004: Observabilidad — OpenTelemetry + health checks extendidos

**Fecha:** 2026-09-12
**Estado:** Aceptado
**Aplica a:** grupojl-control-backend

## Contexto

El sistema que monitorea otros microservicios no tiene monitoring propio.
`GET /health` usa `@nestjs/terminus` (correcto, pero es el piso mínimo).
No hay traces, no hay métricas custom, no hay alertas sobre el propio panel.

## Decisión

### Health check extendido

```json
GET /health → {
  "status": "ok" | "degraded",
  "db":     { "status": "up", "latencyMs": 4 },
  "redis":  { "status": "up", "latencyMs": 1 },
  "uptime": 3600,
  "version": "1.2.3"
}
```

`status: "degraded"` cuando db o redis está up pero latencia > umbral.
Railway usa este endpoint para healthcheck — respuesta en < 200ms obligatoria.

### OpenTelemetry (SDK mínimo viable)

```ts
// src/telemetry.ts — importado ANTES que cualquier otro módulo en main.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
});
sdk.start();
```

**Spans obligatorios (via @nestjs/otel o manual):**
- Toda llamada a Integration Client (`fetchWithCache`) → span con `ecosystem`, `cacheKey`, `hit/miss`
- Toda query Prisma → span automático via `@opentelemetry/instrumentation-pg`
- Toda acción de AdminGuard → span con `uid`, `allowed: true/false`

### Métricas custom (Prometheus via @willsoto/nestjs-prometheus)

| Métrica | Tipo | Labels |
|---------|------|--------|
| `superadmin_cache_hits_total` | Counter | ecosystem, operation |
| `superadmin_cache_misses_total` | Counter | ecosystem, operation |
| `superadmin_admin_actions_total` | Counter | action, ecosystemId, status |
| `superadmin_external_request_duration_seconds` | Histogram | ecosystem, endpoint |

`GET /metrics` expuesto para Railway → Prometheus → Grafana existente.

## Alternativas descartadas

**Solo logs estructurados:** suficiente para debugging pero no para detectar
degradación gradual (cache miss rate subiendo, latencia P95 en fetchWithCache).

**DataDog APM:** kostoso y overkill para un panel interno de 4 operadores.
Railway + Prometheus + Grafana ya está en el stack del ecosistema.

## Consecuencias

**Ganancia:** el sistema que monitorea otros tiene el mismo nivel de observabilidad
que exige a sus consumidos. Un CB abierto en grupojl-control es visible antes
de que un operador reporte que el panel está lento.

**Costo:** ~1 sesión para instalar SDK + instrumentar fetchWithCache + exponer /metrics.

## Variables de entorno nuevas

```
OTEL_EXPORTER_OTLP_ENDPOINT=https://...   # opcional — si no está, traces van a /dev/null
```

## Archivos afectados

- `grupojl-control-backend/src/telemetry.ts` — bootstrap OTel
- `grupojl-control-backend/src/main.ts` — import telemetry primero
- `grupojl-control-backend/src/health/health.controller.ts` — response extendida
- `grupojl-control-backend/src/common/integrations/base.client.ts` — spans en fetchWithCache
