# ADR-015 — Observabilidad implementada — welver

**Fecha:** 2026-09-21
**Estado:** ✅ IMPLEMENTADO

## Qué se implementó

### realsass-sass-back
- [x] LoggerModule (nestjs-pino) con customProps: { service, requestId }
- [x] PrometheusModule → GET /metrics (defaultMetrics + histogramas)
- [x] CorrelationIdMiddleware → X-Request-Id propagado en respuesta
- [x] Health check extendido: DB + Redis + latencyMs + uptime + version
- [x] @Public() en /health para Railway healthcheck automático

### realsass-ecommerce-back
- [x] LoggerModule + PrometheusModule en AppModule
- [x] CorrelationIdMiddleware
- [x] HealthModule creado con health extendido (DB + latencyMs + uptime + version)

### catalog raíz (pnpm-workspace.yaml)
- [x] nestjs-pino: "^4.4.0"
- [x] pino: "^9.7.0"
- [x] pino-pretty: "^13.0.0"
- [x] @willsoto/nestjs-prometheus: "^6.0.0"
- [x] prom-client: "^15.0.0"

### GitHub Actions CI (5 workflows)
- [x] ci-sass-back.yml — typecheck + test + build con path filter
- [x] ci-ecommerce-back.yml — typecheck + test + build con path filter
- [x] ci-sass-front.yml — typecheck + build con path filter
- [x] ci-ecommerce-front.yml — typecheck + build con path filter
- [x] ci-packages.yml — typecheck + build de packages

## Pendiente consciente (infraestructura — no código)
- [ ] pnpm install para regenerar lockfile
- [ ] Branch protection en GitHub → Required checks: ci-sass-back, ci-ecommerce-back
- [ ] OTEL_EXPORTER_OTLP_ENDPOINT en Railway (Grafana Tempo / Honeycomb)
- [ ] Dashboard Grafana Cloud conectado a /metrics

## Norte de referencia
Honeycomb — "Dado cualquier estado en producción, ¿podés entender qué pasó sin deployar código nuevo?"
