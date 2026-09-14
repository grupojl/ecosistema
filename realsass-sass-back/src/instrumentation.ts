/**
 * instrumentation.ts — OpenTelemetry SDK
 *
 * CRÍTICO: Este archivo debe importarse ANTES de cualquier import de NestJS.
 * En main.ts: import './instrumentation'; // primera línea
 *
 * Si se inicializa después de NestJS, los auto-instrumentations
 * no pueden parchear los módulos (ya están cargados en el module cache).
 */
import { NodeSDK }                         from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations }     from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter }              from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter }              from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource }                        from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME }               from '@opentelemetry/semantic-conventions';

const resource = Resource.default().merge(
  new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'realsass-sass-back',
  }),
);

const sdk = new NodeSDK({
  resource,
  traceExporter: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      })
    : undefined,
  metricReader: new PrometheusExporter({
    port:     9464,
    endpoint: '/metrics',
    // No exponer en producción sin autenticación — Railway: usar red privada
    host:     process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Desactivar instrumentaciones de alto ruido en dev
      '@opentelemetry/instrumentation-fs':    { enabled: false },
      '@opentelemetry/instrumentation-dns':   { enabled: false },
    }),
  ],
});

sdk.start();

// Graceful shutdown — evita spans colgados al cerrar Railway
process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
