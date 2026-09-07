# Contratos Internal API — welver

> **Estado (2026-09-07):** endpoints implementados en `realsass-sass-back`.
> Pendiente: migración `add-org-status` + variable `INTERNAL_API_KEY` en Railway.

---

## Auth

```
Header:   x-internal-api-key: <INTERNAL_API_KEY>
Env var:  INTERNAL_API_KEY
Fallo:    401 Unauthorized
Guard:    InternalApiKeyGuard (src/common/guards/internal-api-key.guard.ts)
```

Diferente del `api-key.guard.ts` existente (ese es para tenants externos).

---

## Endpoints implementados

### GET /api/v1/health/extended

Sin auth. Consumido por el superadmin para el Command Center.

```ts
interface ExtendedHealth {
  status:          'ok' | 'degraded' | 'down';
  db:              boolean;
  redis:           boolean;
  circuitBreakers: Array<{ key: string; status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }>;
  dlqDepth:        Record<string, number>;
}
```

sass-back no tiene circuit breakers propios — `circuitBreakers: []` siempre.

---

### GET /internal/organizations

Query params:
- `ecosystemId?` — aceptado pero no filtra (welver es un único ecosistema)
- `status?` — `ACTIVE | SUSPENDED | BLOCKED`
- `plan?` — aceptado pero no filtra (campo plan no existe en schema aún)
- `page?` — default 1
- `limit?` — default 20, max 100

Retorna:
```ts
{
  data: Array<{
    id, name, slug, ecosystemId: 'welver', plan: 'STANDARD',
    status: OrgStatus, ownerEmail, ownerName,
    collaboratorsCount, enabledProducts, createdAt, updatedAt,
    lastPaymentAt: null,      // pendiente integración chatia
    activeConversations: 0,   // pendiente integración chatia
  }>,
  meta: { total, page, limit, pages }
}
```

---

### GET /internal/organizations/:id

Retorna el detalle completo con `collaborators`, `activeTheme` y `webhooks`.

---

### POST /internal/organizations/:id/suspend

Body: `{ reason: string }` — mínimo 10 caracteres.
El superadmin registra `AdminAction` antes de llamar este endpoint.
Retorna `{ success: true, previousStatus, newStatus: 'SUSPENDED', reason }`.

---

### POST /internal/organizations/:id/unsuspend

Body: `{ reason: string }` — mínimo 10 caracteres.
No reactiva orgs con `status = BLOCKED`.
Retorna `{ success: true, previousStatus, newStatus: 'ACTIVE', reason }`.
