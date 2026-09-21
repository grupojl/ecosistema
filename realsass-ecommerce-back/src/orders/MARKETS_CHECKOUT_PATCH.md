# Markets: cambios requeridos en checkout.service.ts (MKT-E-05)

## Pasos a aplicar en el método `checkout()` de CheckoutService

### 1. Importar helpers
```typescript
import { resolveVisitorCountry } from './lib/resolve-visitor-country'
// Si usas OrganizationsClientService, ya tiene resolveMarket()
// Si no, inyectar MarketResolverService
```

### 2. Resolver el Market al inicio del checkout
```typescript
async checkout(
  cartId: string,
  customerId: string,
  orgId: string,
  request: Request,   // ← agregar este parámetro
): Promise<Order> {
  // Resolver Market antes de cualquier operación
  const visitorCountry = resolveVisitorCountry(request) ?? 'AR'
  const market = await this.organizationsClient.resolveMarket(orgId, visitorCountry)
  //                         ↑ o this.marketResolver.resolveMarket(...)
```

### 3. Guardar snapshot al crear la Order (inmutable)
```typescript
  const order = await this.prisma.order.create({
    data: {
      // ... campos existentes ...
      marketId:             market.id,
      visitorCountryCode:   visitorCountry,
      fulfillmentSnapshot:  market.fulfillmentConfig,  // snapshot inmutable
    },
  })
```

### Regla de oro
El `fulfillmentSnapshot` en Order es INMUTABLE una vez creada.
Si el dueño cambia la config del Market después, las órdenes anteriores no se ven afectadas.
Mismo patrón que `unitPriceCentsSnapshot` en CartItem.
