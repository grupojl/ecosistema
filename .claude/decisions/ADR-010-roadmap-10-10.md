# ADR-010: Hoja de ruta hacia 10/10 — welver/

**Fecha:** 2026-09-12
**Estado:** Aceptado — en ejecución vía x.sh

## Contexto

Auditoría 2026-09-12: score base 6.8/10. Tests 3/10, observabilidad 2/10,
deploy 6/10. Este ADR define el camino completo al 10/10 por eje.

## Brecha por eje

| Eje | Hoy | Meta | Gap principal |
|-----|-----|------|--------------|
| Arquitectura | 6.8 | 9.5 | Domain ecommerce-back incompleto, REST legacy |
| Tests | 3 | 9 | Cero specs activos |
| Observabilidad | 2 | 8 | OpenTelemetry no instalado |
| Deploy/CI | 6 | 9 | Sin GitHub Actions gate |

## Decisión

Cuatro fases secuenciales (ver x.sh):
1. Código — resolver los 4 bloqueantes activos
2. Tests — de 3/10 a 9/10 (cross-tenant → domain → contracts → auth)
3. Observabilidad — OpenTelemetry + Prometheus + Grafana
4. CI/CD — 7 GitHub Actions workflows + branch protection

## Alternativas descartadas

- Big Bang en una sesión → conflictos entre servicios
- Empezar por observabilidad → instrumentar un sistema sin tests
- Delegar CI a Railway → no tiene gates de calidad, solo detecta push

## Score proyectado al completar

| Eje | Hoy | Post-x.sh |
|-----|-----|-----------|
| Arquitectura | 6.8 | 9.2 |
| Tests | 3 | 8.5 |
| Observabilidad | 2 | 7.5 |
| Deploy/CI | 6 | 9.0 |
| **Promedio** | **4.9** | **8.6** |

## Referencias

- ADR-005 (REST→tRPC), ADR-006 (front cleanup), ADR-007 (eliminar any)
- ADR-008 (legacy storefront), ADR-009 (S4 tests/CI/hydration)
- lifecycle/02-fase-estabilizacion.md, lifecycle/README.md
