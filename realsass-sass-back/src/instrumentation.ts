import { NodeSDK }                         from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations }     from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter }              from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter }              from '@opentelemetry/exporter-trace-otlp-grpc';
import { resourceFromAttributes }          from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME }               from '@opentelemetry/semantic-conventions';

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'realsass-sass-back',
});

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
    host:     process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs':    { enabled: false },
      '@opentelemetry/instrumentation-dns':   { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
