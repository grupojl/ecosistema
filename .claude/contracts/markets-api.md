> **Estado:** ✅ IMPLEMENTADO — 2026-09-21
>
# Contratos: Markets API

## tRPC procedures (sass-back → todos los consumidores)

```typescript
// packages/trpc/src/routers/markets.ts

// Input schemas (Zod)
const FulfillmentConfigSchema = z.object({
  provider:       z.string().optional(),
  contactEmail:   z.string().email().optional(),
  notes:          z.string().optional(),
  priority:       z.number().int().min(1).default(1),
})

const CreateMarketInput = z.object({
  organizationId:    z.string().uuid(),
  countryCode:       z.string().length(2).toUpperCase(), // ISO 3166-1 alpha-2
  fulfillmentConfig: FulfillmentConfigSchema.optional(),
})

const ResolveMarketInput = z.object({
  organizationId: z.string().uuid(),
  countryCode:    z.string().length(2).toUpperCase(),
})

// Output type
type MarketDTO = {
  id:                string
  organizationId:    string
  countryCode:       string   // "AR" | "CO" | "MX" ...
  isDefault:         boolean
  isActive:          boolean
  fulfillmentConfig: FulfillmentConfig
  createdAt:         string
  updatedAt:         string
}
```

## HTTP endpoints (via tRPC HTTP adapter)

| Método | Path | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/trpc/markets.list?input={"organizationId":"..."}` | JWT owner/admin | Lista Markets de la org |
| POST | `/trpc/markets.create` | JWT owner | Crear nuevo Market |
| PATCH | `/trpc/markets.update` | JWT owner | Actualizar fulfillmentConfig o isActive |
| POST | `/trpc/markets.setDefault` | JWT owner | Cambiar Market default |
| GET | `/trpc/markets.resolve?input={"organizationId":"...","countryCode":"CO"}` | INTERNAL_API_KEY | Resolver Market para fulfillment |

## Header de contexto de país

```
X-Visitor-Country: CO   // ISO 3166-1 alpha-2, enviado por el front
```

Procesado en ecommerce-back como primer input de `resolveMarket()`.

## Países soportados inicialmente (expandible sin código)

AR · CO · MX · BR · CL · UY · PE · EC · BO · PY

Agregar un país = crear un Market en el dashboard. Sin deploys.
