# Markets en real-ecommerce-front — resolución del visitante

## Responsabilidad

El storefront es el punto de entrada del comprador.
Su responsabilidad respecto a Markets:

1. Detectar el país del visitante (IP o selección manual)
2. Enviar `X-Visitor-Country` header en requests al backend
3. Mostrar un selector de país/mercado si la org tiene múltiples Markets activos
4. Adaptar la UX al Market resuelto (nombre de proveedor, info de envío local)

## Selector de mercado (UX pattern de Shopify)

Shopify muestra un banner/modal al detectar que el visitante es de un país diferente:
"Parece que estás en Colombia. ¿Querés ver los envíos desde nuestro proveedor local?"

Implementar como:
- Componente `<MarketBanner />` — aparece si `detectedCountry !== currentMarket.countryCode`
- Zustand store `useMarketStore` — persiste la selección del usuario en sessionStorage
- Si el usuario elige → setea `X-Visitor-Country` en todos los requests posteriores

## Checklist de implementación

- [ ] MKT-F-01: `useMarketStore` en Zustand — `{ currentCountry, setCountry }`
- [ ] MKT-F-02: `resolveVisitorCountry()` en `lib/market/resolver.ts`
- [ ] MKT-F-03: Interceptor en `apiFetch` para agregar `X-Visitor-Country` header
- [ ] MKT-F-04: `<MarketBanner />` componente (shadcn/ui Alert base)
- [ ] MKT-F-05: Integrar en `store-provider.tsx` — detectar país al montar la tienda
