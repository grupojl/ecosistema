# Markets en ecommerce-back — consumidor del contexto global

## Rol en este servicio

`ecommerce-back` NO posee el modelo Market — lo consume desde `sass-back` vía tRPC.
Su responsabilidad es **resolver el Market del visitante antes de cualquier operación
de fulfillment** (creación de orden, cálculo de envío, asignación de proveedor).

## Flujo de resolución en checkout

```
POST /checkout (ecommerce-back)
  → 1. Leer visitorCountryCode del request (header X-Visitor-Country o IP)
  → 2. Llamar trpc.markets.resolve({ organizationId, countryCode })
  → 3. Guardar marketId + fulfillmentConfig en la Order
  → 4. Stripe procesa el pago (él maneja multi-moneda)
  → 5. Orden creada con contexto de Market resuelto
```

## Campos nuevos en Order (ecommerce-back/prisma/schema.prisma)

```prisma
model Order {
  // ... campos existentes ...
  marketId            String?  @map("market_id")        // Market resuelto al momento del checkout
  visitorCountryCode  String?  @map("visitor_country_code") // País detectado del visitante
  fulfillmentSnapshot Json     @default("{}") @map("fulfillment_snapshot")
  // Snapshot de fulfillmentConfig al momento de la orden — inmutable post-creación
}
```

## Detección del país del visitante

Orden de precedencia (de mayor a menor prioridad):
1. Header `X-Visitor-Country` (enviado por el front si el usuario lo seleccionó)
2. Header `CF-IPCountry` (Cloudflare, si se usa como CDN)
3. IP geolocation via servicio externo (MaxMind o ip-api.com como fallback)
4. País default de la Organization

```typescript
// lib/resolve-visitor-country.ts en real-ecommerce-front
function resolveVisitorCountry(request: NextRequest): string {
  return (
    request.headers.get('X-Visitor-Country') ??
    request.headers.get('CF-IPCountry') ??
    'default' // ecommerce-back hará fallback al Market default
  )
}
```

## Checklist de implementación

- [x] MKT-E-01: tRPC client call a `markets.resolve` desde `OrganizationsClientService`
- [x] MKT-E-02: Migración Prisma — `marketId` + `visitorCountryCode` + `fulfillmentSnapshot` en `Order`
- [x] MKT-E-03: `resolveVisitorCountry()` util en real-ecommerce-front
- [x] MKT-E-04: Pasar `X-Visitor-Country` header en requests de checkout desde el front
- [x] MKT-E-05: Guardar `fulfillmentSnapshot` al crear Order (inmutable)
- [x] MKT-E-06: Test de integración — checkout con CO resuelve Market CO, sin Market CO resuelve default

## Regla de oro

El `fulfillmentSnapshot` en Order es **inmutable** una vez creada.
Si el dueño cambia la config del Market después, las órdenes anteriores no se ven afectadas.
Mismo patrón que `unitPriceCentsSnapshot` en CartItem — snapshot al momento de la transacción.
