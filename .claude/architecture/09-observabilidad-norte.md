# 09 — Norte de observabilidad: qué instrumentar y por qué

> Referentes: **Honeycomb** (entender cualquier estado en prod sin deployar código),
> **Datadog** (qué ve el operador), **Shopify** (trazabilidad de BullMQ jobs).

---

## El principio de Honeycomb

> "Dado cualquier estado en producción, ¿podés entender qué pasó
> sin deployar código nuevo?"

---

## Qué genera un span

```
Request HTTP entrante     → automático via instrumentation-http
Query Prisma              → automático via instrumentation-prisma
Llamada gRPC saliente     → manual en GrpcClient
Job BullMQ encolado       → manual en el service que encola
Job BullMQ procesado      → manual en el Processor
Llamada a provider externo → manual en el Adapter
CB estado                 → evento en el span del Adapter (no span propio)
Cache hit/miss            → atributo en el span del caller (no span propio)
Health check polling      → excluir del sampler
```

---

## Atributos obligatorios en spans de negocio

```ts
span.setAttributes({
  'tenant.ecosystem_id':    ecosystemId,
  'tenant.organization_id': organizationId,
  'service.name':           'superadmin-backend',
  'request.id':             correlationId,
});
```

---

## Qué activa una alerta vs. qué es contexto

### Alerta (acción en < 15 min)
```
CB OPEN en provider de pagos    → CRÍTICA
DLQ depth > 100 jobs            → CRÍTICA
Health check DOWN               → CRÍTICA
Error rate > 5% en 5 min        → WARNING
Latencia P95 > 2s en pagos      → WARNING
CB OPEN en Groq/LLM             → WARNING
```

### Contexto (dashboard, no alerta)
```
Cache hit/miss rate
Latencia P50 Prisma
Jobs procesados por hora
Requests por tenant
```

**Regla Datadog:** si no cambia una decisión operativa en los próximos 15 min,
no es una alerta.

---

## Health check extendido — formato canónico

```json
{
  "status": "ok" | "degraded" | "down",
  "db":    { "status": "up", "latencyMs": 4 },
  "redis": { "status": "up", "latencyMs": 1 },
  "circuit_breakers": { "mercadopago": "closed", "groq-llm": "open" },
  "queues": { "payments": { "waiting": 0, "dlq": 0 } },
  "uptime": 3600,
  "version": "1.2.3"
}
```

---

## Correlation ID

```ts
app.use((req, res, next) => {
  const id = req.headers['x-correlation-id'] as string ?? crypto.randomUUID();
  req.headers['x-correlation-id'] = id;
  res.setHeader('x-correlation-id', id);
  trace.getActiveSpan()?.setAttribute('request.id', id);
  next();
});
```

---

## Señal de observabilidad bien implementada

1. Pago fallido → span del provider en < 2 min sin grep en logs
2. Job en DLQ → trazable al request HTTP que lo originó
3. CB abierto → visible en superadmin en < 15 segundos
4. Podés filtrar spans de una org por `tenant.organization_id`
