# 09 — Norte de observabilidad: qué instrumentar y por qué

> Referentes: **Honeycomb** (observabilidad real — entender cualquier estado en
> producción sin deployar código nuevo), **Datadog** (qué ve el operador en el
> dashboard), **Shopify** (trazabilidad de jobs BullMQ desde el request original).
>
> Aplica a los tres monorepos. Los ejemplos usan el stack real del ecosistema.

---

## El principio de Honeycomb (Charity Majors)

> "Observabilidad real es: dado cualquier estado que tu sistema pueda tener
> en producción, ¿podés entender qué pasó sin deployar código nuevo?"

Para este ecosistema eso significa: cuando el DLQ de workers-backend se satura,
el trace de un job fallido muestra exactamente qué paso falló, con qué payload,
en qué intento, originado por qué request HTTP, de qué organización.

Eso no lo da logging estructurado solo. Requiere trazas distribuidas con contexto
propagado entre servicios.

---

## Qué genera un span — regla por límite de servicio

Un span va en cada lugar donde el tiempo es observable y el fallo es accionable.

### Límites obligatorios

```
Request HTTP entrante         → span automático via @opentelemetry/instrumentation-http
Query Prisma                  → span automático via @opentelemetry/instrumentation-prisma
Llamada gRPC saliente         → span manual en el GrpcClient
Llamada gRPC entrante         → span automático via @grpc/grpc-js instrumentation
Job BullMQ encolado           → span manual en el service que encola
Job BullMQ procesado          → span manual en el Processor
Llamada a provider externo    → span manual en el Adapter (MercadoPago, Stripe, SendGrid, etc.)
Circuit Breaker — estado      → evento en el span del Adapter (no span propio)
Cache Redis — hit/miss        → atributo en el span del caller (no span propio)
```

### Lo que NO genera un span

```
Getters/setters internos      → ruido sin valor operativo
Logs de arranque              → van en logs estructurados, no en trazas
Health check polling          → excluir del sampler (genera >95% del tráfico sin valor)
```

---

## Atributos obligatorios en todo span de negocio

Honeycomb y Datadog son inútiles si los spans no tienen contexto para filtrar.
Todo span que toca datos de negocio lleva:

```ts
span.setAttributes({
  'tenant.ecosystem_id':    ecosystemId,    // filtro primario multi-tenant
  'tenant.organization_id': organizationId, // filtro secundario
  'service.name':           'chatia-backend', // automático via SDK
  'request.id':             correlationId,   // propagado desde el request HTTP original
});
```

El `correlationId` se genera una vez en el API Gateway o en el primer request HTTP
y se propaga en todos los spans downstream — incluidos gRPC y BullMQ jobs.

---

## Propagación de traceId en BullMQ (patrón Shopify)

Shopify documentó que un job en background sin el traceId del request que lo originó
es un job huérfano — imposible de trazar en un incidente.

```ts
// ✅ Al encolar el job — propagar el contexto de tracing
import { context, propagation } from '@opentelemetry/api';

async scheduleJob(payload: JobPayload): Promise<void> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier); // inyecta traceId en el carrier

  await this.queue.add('process-payment', {
    ...payload,
    _traceCarrier: carrier, // viaja con el job
  });
}

// ✅ Al procesar el job — restaurar el contexto
async process(job: Job<JobPayload>): Promise<void> {
  const parentCtx = propagation.extract(
    context.active(),
    job.data._traceCarrier ?? {}
  );

  return context.with(parentCtx, async () => {
    const span = tracer.startSpan('job.process-payment');
    // el span es hijo del request HTTP que originó el job
    try {
      await this.doWork(job.data);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

---

## Qué activa una alerta vs. qué es solo contexto

### Alerta (acción requerida en < 15 minutos)

```
Circuit Breaker OPEN en provider de pagos     → alerta CRÍTICA
                                                 (cobros parados)
DLQ depth > 100 jobs                          → alerta CRÍTICA
                                                 (procesamiento detenido)
Health check DOWN en cualquier servicio       → alerta CRÍTICA
Error rate > 5% en últimos 5 minutos          → alerta WARNING
Latencia P95 > 2s en endpoints de pago        → alerta WARNING
Circuit Breaker OPEN en Groq/LLM              → alerta WARNING
                                                 (chat degradado, no parado)
```

### Contexto (visible en dashboard, no alerta)

```
Cache hit/miss rate                           → métrica de eficiencia
Latencia P50 de queries Prisma                → baseline de salud
Número de jobs procesados por hora            → throughput normal
Número de requests por tenant/ecosistema      → distribución de carga
```

**Regla Datadog:** si no cambia una decisión operativa en los próximos 15 minutos,
no es una alerta — es una métrica de dashboard.

---

## Métricas custom obligatorias (Prometheus)

```ts
// Contadores — para alertas de rate
superadmin_admin_actions_total{action, ecosystem_id, status}
payment_processed_total{provider, country, status}
notification_sent_total{channel, status}
job_processed_total{queue, status}

// Histogramas — para alertas de latencia
payment_provider_duration_seconds{provider, country}
grpc_call_duration_seconds{service, method}
llm_response_duration_seconds{model}

// Gauges — para alertas de estado
circuit_breaker_state{service, key}   // 0=closed, 1=half-open, 2=open
dlq_depth{queue}                      // jobs en DLQ por cola
```

---

## Health check extendido — formato canónico

El `GET /health` básico de `@nestjs/terminus` dice "arriba/abajo".
El health extendido dice "arriba, degradado, y por qué".

```json
GET /health → {
  "status": "ok" | "degraded" | "down",
  "db":     { "status": "up", "latencyMs": 4 },
  "redis":  { "status": "up", "latencyMs": 1 },
  "circuit_breakers": {
    "mercadopago": "closed",
    "stripe":      "closed",
    "groq-llm":    "open"     ← visible en superadmin Command Center
  },
  "queues": {
    "payments":      { "waiting": 0, "dlq": 0 },
    "notifications": { "waiting": 12, "dlq": 0 }
  },
  "uptime":  3600,
  "version": "1.2.3"
}
```

`status: "degraded"` cuando el servicio funciona pero con capacidad reducida
(un CB abierto, Redis lento, queue acumulando). Railway no revierte el deploy
con degraded — pero superadmin lo muestra como alerta WARNING.

---

## Correlation ID — implementación mínima

Sin correlation ID, un error en workers-backend es invisible desde el request
HTTP de welver que lo originó.

```ts
// middleware global en main.ts de cada servicio
app.use((req, res, next) => {
  const correlationId =
    req.headers['x-correlation-id'] as string ??
    crypto.randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  // propagar al contexto de OpenTelemetry
  const span = trace.getActiveSpan();
  span?.setAttribute('request.id', correlationId);
  next();
});

// Al llamar a otro servicio (HTTP o gRPC), propagar el header
headers['x-correlation-id'] = correlationId;
```

---

## Señal de que la observabilidad está bien implementada

1. Dado un pago fallido en producción, podés llegar al span del provider en < 2 minutos
   sin grep en los logs del servidor.
2. Dado un job atascado en DLQ, podés trazar el request HTTP que lo originó.
3. Cuando el CB de Groq se abre, el operador lo ve en superadmin en < 15 segundos
   sin revisar Railway logs.
4. Podés filtrar todos los spans de una organización específica por `tenant.organization_id`.

Si alguno de estos cuatro no es posible, la observabilidad está incompleta.
