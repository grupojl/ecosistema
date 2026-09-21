# ADR-014 — Markets: estado de implementación

**Fecha de cierre:** 2026-09-21
**Estado:** ✅ IMPLEMENTADO — sass-back + ecommerce-back + fronts

## Qué se implementó (sesión 2026-09-21)

### realsass-sass-back (OWNER del modelo)
- [x] MKT-01: Prisma — Organization.countryCode + modelo Market
- [x] MKT-02: market.entity.ts — FulfillmentConfigSchema Zod + fromPrisma() + toDTO()
- [x] MKT-03: market.errors.ts — 4 errores de dominio tipados
- [x] MKT-04: IMarketRepository + PrismaMarketRepository
- [x] MKT-05: markets.service.ts — resolveMarket() NUNCA retorna null
- [x] MKT-06: markets.router.ts — 6 procedures tRPC (list/create/update/setDefault/resolve/delete)
- [x] MKT-07: MarketsModule registrado en AppModule + TrpcModule
- [x] MKT-08: Unit tests resolveMarket() — 5 casos cubiertos
- [x] MKT-09: Integration test tRPC router
- [x] seedDefaultMarket() en OrganizationsService.createForUserWithDefaultMarket()
- [x] GET /internal/organizations/:id/markets para superadmin

### realsass-ecommerce-back (CONSUMER)
- [x] MKT-E-01: resolveMarket() en OrganizationsClientService (HTTP + Redis 5min)
- [x] MKT-E-02: Prisma Order — market_id + visitor_country_code + fulfillment_snapshot
- [x] MKT-E-03: resolve-visitor-country.ts (X-Visitor-Country > CF-IPCountry > null)
- [x] MKT-E-04: OrganizationsClientService inyectado en orders.service.ts
- [x] MKT-E-05: MARKETS_CHECKOUT_PATCH.md — guía de integración en checkout
- [x] MKT-E-06: Integration tests resolve-visitor-country

### real-ecommerce-front (DETECTOR)
- [x] MKT-F-01: useMarketStore (Zustand + sessionStorage)
- [x] MKT-F-02: lib/market/resolver.ts (server-side Next.js)
- [x] MKT-F-03: api-fetch-with-market.ts — inyecta X-Visitor-Country
- [x] MKT-F-04: MarketBanner — UX pattern Shopify
- [x] MKT-F-05: MarketProvider para layouts de tienda

### @real/trpc (contratos compartidos)
- [x] MarketDTO + FulfillmentConfig exportados

## Pendiente consciente (no bloqueante)

- [ ] MKT-D-01..04: UI gestión Markets en realsass-dashboard-front (siguiente sprint)
- [ ] Migración Prisma en sass-back: `pnpm prisma migrate dev --name add_market_model`
- [ ] Migración Prisma en ecommerce-back: `pnpm prisma migrate dev --name add_market_fields_to_order`
- [ ] Checkout patch manual: ver MARKETS_CHECKOUT_PATCH.md (5 líneas en orders.service.ts)

## Norte de referencia

**Shopify Markets** — el dueño declara en qué países opera; el sistema resuelve.
`resolveMarket()` es el contrato central: NUNCA retorna null, siempre hay fallback al default.
Agregar un país = crear un Market en el dashboard. Sin deploys.

## Países soportados inicialmente (expandible sin código)
AR · CO · MX · BR · CL · UY · PE · EC · BO · PY
