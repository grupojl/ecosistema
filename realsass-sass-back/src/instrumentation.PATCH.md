# Instrucción manual — modificar main.ts

Agregar como **primera línea** de `realsass-sass-back/src/main.ts`:

```typescript
import './instrumentation'; // OpenTelemetry — debe ser el primer import
```

## Por qué manual

x.sh no modifica main.ts automáticamente para evitar conflictos con
contenido existente que no puede predecir. Este es un cambio de 1 línea.

## Variables de entorno para Railway

Agregar en el servicio realsass-sass-back:
```
OTEL_SERVICE_NAME=realsass-sass-back
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <tu-token-grafana>
```

El endpoint de Prometheus (`:9464/metrics`) es para scraping interno de Railway.
Si no tenés Grafana Agent todavía, omitir OTEL_EXPORTER y solo usar Prometheus.
