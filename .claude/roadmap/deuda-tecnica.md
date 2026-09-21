# Deuda técnica — welver

Última actualización: 2026-09-19

---

## Cerrado en sesión 2026-09-19 ✅

- [x] InternalModule con pause-store/resume-store en realsass-sass-back
- [x] Prisma schema limpio (OrgStatus + StoreStatus solo en Organization)
- [x] ecommerceEnabled: org.storeStatus === 'ACTIVE'
- [x] GET /organizations/public/by-slug/:slug expuesto

---

## Pendiente activo — P0 para producción

### [WEL-01] Migración Prisma — BLOQUEANTE
```bash
cd realsass-sass-back
pnpm prisma migrate dev --name add-superadmin-org-fields
```
Sin esta migración, el deploy en Railway falla al arrancar
(entrypoint.sh corre `prisma migrate deploy` al inicio).

### [WEL-02] INTERNAL_API_KEY en Railway
Variable de entorno en realsass-sass-back.
Sin esto, grupojl-control recibe 403 en /internal/organizations.

---

## Pendiente activo — P1

### [WEL-03] HydrationBoundary en dashboard-front
- realsass-dashboard-front/app/dashboard/tienda/productos/page.tsx
- realsass-dashboard-front/app/dashboard/tienda/pedidos/page.tsx
Patrón documentado en .claude/decisions/ADR-009.

### [WEL-04] GitHub Actions — 7 workflows
Documentados en .claude/decisions/ADR-013.
Trigger: antes de onboardear al primer colaborador externo.

---

## Deuda conocida — no urgente

- DTOs con class-validator en controllers REST legacy — no agregar más
- `checkout.controller.ts` — paymentIntentId en null hasta pagos-back
- Storefront pages /tienda/[slug]/ con JSX inline — pendiente design system

---

## Sprint Markets — ADR-014 ✅ COMPLETADO 2026-09-21

- [x] sass-back: MKT-01..09 — modelo Market + resolveMarket() + tRPC router
- [x] ecommerce-back: MKT-E-01..06 — resolveMarket consumer + Order fields
- [x] ecommerce-front: MKT-F-01..05 — useMarketStore + MarketBanner + detector
- [x] @real/trpc: MarketDTO + FulfillmentConfig exportados
- [x] Wiring: MarketsModule en AppModule + TrpcModule, marketsService en handler
- [x] Internal: GET /internal/organizations/:id/markets para superadmin

### Pendiente siguiente sprint
- [ ] MKT-D-01..04: UI gestión Markets en dashboard-front
- [ ] Migraciones Prisma en sass-back + ecommerce-back (requiere DB)
- [ ] Checkout patch (MARKETS_CHECKOUT_PATCH.md) en orders.service.ts

---

## Observabilidad ✅ COMPLETADA 2026-09-21

- [x] OBS-W-01/02: LoggerModule + PrometheusModule en sass-back
- [x] OBS-W-03: CorrelationIdMiddleware en sass-back
- [x] OBS-W-04: Health check extendido sass-back
- [x] OBS-W-05/06: LoggerModule + PrometheusModule en ecommerce-back
- [x] OBS-W-07: CorrelationIdMiddleware en ecommerce-back
- [x] OBS-W-08: Health check extendido ecommerce-back
- [x] OBS-W-09: GitHub Actions CI (5 workflows con path filters)
- [x] Catalog raíz: nestjs-pino + pino-pretty + prometheus

### Pendiente (infraestructura — no código)
- [ ] pnpm install para regenerar lockfile
- [ ] Branch protection en GitHub
- [ ] OTEL_EXPORTER_OTLP_ENDPOINT en Railway
