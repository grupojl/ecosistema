# Contrato: Integración welver → marketing-backend

> **Estado: Implementado ✅ en ecosistema-ms** — welver no tiene código de marketing.
> Este contrato es documentación de arquitectura del flujo cross-repo.
> Ver ecosistema-ms para la implementación real.


## Principio

welver (pasarelapagos-backend) produce eventos de conversión para marketing-backend.
La comunicación es vía BullMQ sobre Redis compartido — NO gRPC, NO HTTP directo.
Esto es fire-and-forget: si marketing-backend no está disponible, el pago no revierte.

---

## Flujo de atribución

```
pasarelapagos-backend
  ↓ payment COMPLETED
  ↓ fire-forget (NO await)
  → BullMQ queue: marketing-attribution
  → Job: attribute-conversion
  → Redis compartido

marketing-backend
  ↑ AttributeConversionProcessor consume el job
  ↑ Busca campaña activa de la org para atribuir
  ↑ Crea AttributionEvent en su DB
  ↑ Emite a analytics-backend (analytics-events queue) → fire-forget
```

---

## Payload del job attribute-conversion

```typescript
interface AttributeConversionJobData {
  paymentId:      string;   // UUID del pago en pasarelapagos DB
  ecosystemId:    string;   // para multi-tenant isolation
  organizationId: string;   // para multi-tenant isolation
  revenue:        string;   // Decimal como string — evitar float precision
  currency:       string;   // 'ARS' | 'USD' | 'MXN' | ...
  occurredAt:     string;   // ISO 8601
}
```

---

## JobId determinista

```typescript
const jobId = `attribution:${paymentId}`;
```

Garantiza que un mismo pago nunca genera dos `AttributionEvent`,
incluso si el job se reencola por retry de BullMQ.

---

## Regla de degradación elegante

Si `marketing-backend` está caído o la queue está saturada:
- El pago queda confirmado normalmente en `pasarelapagos-backend`
- El job queda en la queue con retries (attempts: 3, backoff exponencial)
- Si los 3 intentos fallan → el job va a DLQ de `marketing-backend`
- NO hay alerta crítica — la atribución es best-effort, no bloqueante

---

## Variables de entorno requeridas en pasarelapagos-backend

```bash
REDIS_URL=  # mismo que marketing-backend — es lo único que los conecta
```

No se necesita `MARKETING_BACKEND_URL` — la comunicación es por Redis, no HTTP.

---

## Verificación en desarrollo local

```bash
# 1. Confirmar que ambos servicios usan el mismo Redis
docker exec -it redis redis-cli
> KEYS marketing-attribution:*

# 2. Forzar un pago COMPLETED y verificar el job
> LLEN bull:marketing-attribution:wait

# 3. Ver jobs procesados
> SMEMBERS bull:marketing-attribution:completed
```
