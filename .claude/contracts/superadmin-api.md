# Contrato: /internal/* para superadmin

Todos los endpoints están bajo `realsass-sass-back`.
Auth: `x-internal-api-key: $INTERNAL_API_KEY` (mismo valor que ecosistema-ms).

---

## GET /internal/organizations

```ts
// Query params
interface ListOrgsQuery {
  ecosystemId?: string;
  status?:      'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  storeStatus?: 'ACTIVE' | 'PAUSED';
  page?:        number;   // default: 1
  limit?:       number;   // default: 50
  search?:      string;
}

// Response item
interface InternalOrg {
  id:           string;
  ecosystemId:  string;
  name:         string | null;
  slug:         string | null;
  status:       'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  storeStatus:  'ACTIVE' | 'PAUSED';
  plan:         string;
  suspendedAt?: string;
}
```

## POST /internal/organizations/:id/suspend | /unsuspend

```ts
// Body
interface OrgActionBody {
  reason: string;  // min 10 chars
}
```

## POST /internal/organizations/:id/store-pause | /store-resume

```ts
// Body
interface StoreActionBody {
  reason: string;  // min 10 chars
}
```

## Errores canónicos

- `409 Conflict` — store ya está en el estado pedido
- `404 Not Found` — organización no existe
- `403 Forbidden` — x-internal-api-key inválida o ausente

---

## marketing-backend — /internal/*

Auth: mismo `x-internal-api-key` header.
Base URL configurada en superadmin como `MARKETING_BACKEND_URL`.

### GET /internal/campaigns

```ts
// Query params
interface ListCampaignsQuery {
  ecosystemId?:    string;
  organizationId?: string;
  platform?:       'META' | 'GOOGLE' | 'TIKTOK';
  status?:         'ACTIVE' | 'PAUSED' | 'DELETED';
  page?:           number;  // default: 1
  limit?:          number;  // default: 50, max: 100
}

// Response item
interface InternalCampaign {
  id:             string;
  ecosystemId:    string;
  organizationId: string;
  name:           string;
  platform:       'META' | 'GOOGLE' | 'TIKTOK';
  status:         'ACTIVE' | 'PAUSED' | 'DELETED';
  dailyBudget:    string | null;  // Decimal como string
  lastSyncAt:     string | null;
}
```

### GET /internal/ad-accounts

```ts
interface ListAdAccountsQuery {
  ecosystemId?:    string;
  organizationId?: string;
}

interface InternalAdAccount {
  id:             string;
  ecosystemId:    string;
  organizationId: string;
  platform:       'META' | 'GOOGLE' | 'TIKTOK';
  name:           string;
  status:         'ACTIVE' | 'INACTIVE' | 'ERROR';
  // accessToken NUNCA se retorna
}
```

### GET /internal/metrics/summary

Agrega ROAS, spend y conversiones de los últimos 30 días.

```ts
interface MetricsSummaryQuery {
  ecosystemId:     string;
  organizationId?: string;  // si omitido → agrega todo el ecosystem
  from?:           string;  // ISO date, default: hace 30 días
  to?:             string;  // ISO date, default: hoy
}

interface MetricsSummaryResponse {
  totalSpend:       string;
  totalRevenue:     string;
  totalConversions: number;
  roas:             string;  // totalRevenue / totalSpend
  byPlatform: Array<{
    platform:    'META' | 'GOOGLE' | 'TIKTOK';
    spend:       string;
    revenue:     string;
    conversions: number;
    roas:        string;
  }>;
}
```

### GET /internal/attribution

```ts
interface AttributionQuery {
  ecosystemId:     string;
  organizationId?: string;
  from?:           string;  // ISO date
  to?:             string;  // ISO date
  page?:           number;
  limit?:          number;
}

interface AttributionEvent {
  id:             string;
  paymentId:      string;
  campaignId:     string | null;
  platform:       'META' | 'GOOGLE' | 'TIKTOK' | null;
  revenue:        string;
  attributedAt:   string;
  organizationId: string;
  ecosystemId:    string;
}
```
