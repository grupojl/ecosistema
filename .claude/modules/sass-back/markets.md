# Módulo: Markets — realsass-sass-back

## Bounded context

`Market` representa la presencia operativa de una `Organization` en un país.
Una organización puede tener múltiples Markets activos.
Siempre existe un Market `isDefault: true` (el país base del dueño).

## Invariantes de dominio

1. Toda Organization tiene exactamente UN Market con `isDefault: true`
2. No pueden existir dos Markets con el mismo `(organizationId, countryCode)`
3. El Market default no puede ser desactivado si es el único activo
4. `countryCode` usa ISO 3166-1 alpha-2 (AR, CO, MX, BR, CL, UY...)
5. `fulfillmentConfig` es JSONB validado con Zod en application layer — nunca raw en controller

## Schema Prisma (agregar en realsass-sass-back/prisma/schema.prisma)

```prisma
// Agregar en model Organization:
//   countryCode  String   @default("AR") @map("country_code")
//   markets      Market[]

model Market {
  id                 String   @id @default(uuid())
  organizationId     String   @map("organization_id")
  countryCode        String   @map("country_code")      // ISO 3166-1 alpha-2
  isDefault          Boolean  @default(false) @map("is_default")
  isActive           Boolean  @default(true) @map("is_active")
  fulfillmentConfig  Json     @default("{}") @map("fulfillment_config")
  // fulfillmentConfig shape (Zod):
  // { provider?: string, contactEmail?: string, notes?: string, priority?: number }
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, countryCode])
  @@index([organizationId, isActive])
  @@map("markets")
}
```

## Estructura de archivos nuevos

```
realsass-sass-back/src/
  markets/
    domain/
      market.entity.ts          ← entidad + invariantes
      market.errors.ts          ← MarketNotFoundError, DuplicateMarketError, etc.
    repository/
      market.repository.interface.ts
      prisma-market.repository.ts
    markets.module.ts
    markets.service.ts          ← resolveMarket() vive aquí
  trpc/routers/
    markets.router.ts           ← CRUD + resolveMarket tRPC procedure
```

## resolveMarket() — la función central

```typescript
// markets.service.ts
async resolveMarket(organizationId: string, visitorCountryCode: string): Promise<Market> {
  const specific = await this.repo.findActive(organizationId, visitorCountryCode)
  if (specific) return specific

  const fallback = await this.repo.findDefault(organizationId)
  if (!fallback) throw new MarketNotFoundError(organizationId)

  return fallback
}
```

Esta función es el contrato central. Todo lo que dependa de país la llama.

## Endpoints HTTP (a través de tRPC)

| Procedure | Input | Output | Quién llama |
|-----------|-------|--------|-------------|
| `markets.list` | `{ organizationId }` | `Market[]` | dashboard-front, superadmin |
| `markets.create` | `{ organizationId, countryCode, fulfillmentConfig? }` | `Market` | sass-front (owner) |
| `markets.update` | `{ id, fulfillmentConfig?, isActive? }` | `Market` | sass-front (owner) |
| `markets.resolve` | `{ organizationId, countryCode }` | `Market` | ecommerce-back (interno) |
| `markets.setDefault` | `{ id }` | `Market` | sass-front (owner) |

## Checklist de implementación

- [x] MKT-01: Migración Prisma — agregar `countryCode` en `Organization` + modelo `Market`
- [x] MKT-02: `market.entity.ts` con invariantes tipadas
- [x] MKT-03: `market.errors.ts` — `MarketNotFoundError`, `DuplicateMarketError`, `CannotDeactivateDefaultMarketError`
- [x] MKT-04: `prisma-market.repository.ts` — `findActive()`, `findDefault()`, `findAll()`
- [x] MKT-05: `markets.service.ts` — `resolveMarket()` + CRUD
- [x] MKT-06: `markets.router.ts` tRPC con Zod validation en cada procedure
- [x] MKT-07: Seed del Market default al crear Organization (en `organizations.service.ts`)
- [x] MKT-08: Unit tests de `resolveMarket()` — caso específico, caso fallback, caso error
- [x] MKT-09: Integration test tRPC — create, resolve, setDefault

## Reglas duras

- `resolveMarket()` NUNCA retorna null — siempre Market o throw
- Al crear Organization → crear Market default automáticamente (mismo `countryCode` que org)
- El `countryCode` en Organization es inmutable después de creación (ADR futuro si cambia)
- `fulfillmentConfig` siempre validado con Zod antes de persistir — nunca `as any`
