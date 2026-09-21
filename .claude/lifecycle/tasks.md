# tasks.md — welver estado actual

**Última actualización:** 2026-09-19 — .claude actualizado con estado real de marketing

---

## COMPLETADO ✅ — Sesión 2026-09-19

### realsass-sass-back
- [x] InternalModule — internal-organizations.controller.ts
- [x] InternalModule — internal-organizations.service.ts (con pause/resume store)
- [x] InternalModule — internal-api-key.guard.ts
- [x] InternalModule registrado en app.module.ts
- [x] Prisma schema — OrgStatus + StoreStatus (una sola vez, solo en Organization)
- [x] Prisma schema — ecosystemId, plan, status, suspendedAt, storeStatus en Organization
- [x] ecommerceEnabled: org.storeStatus === 'ACTIVE' en prisma-organizations.repository.ts
- [x] GET /api/v1/organizations/public/by-slug/:slug expuesto y @Public()

---

## Verificación de completitud

```bash
# Desde la raíz de welver/
grep -n "storeStatus\|OrgStatus\|StoreStatus\|ecosystemId\|suspendedAt" \
  realsass-sass-back/prisma/schema.prisma

grep -n "ecommerceEnabled" \
  realsass-sass-back/src/organizations/repository/prisma-organizations.repository.ts

ls realsass-sass-back/src/internal/
```

---

## RESUELTO EXTERNAMENTE ✅ — Integración marketing-backend

> Este pendiente fue documentado en welver por error de contexto.
> El fire-forget y el microservicio marketing-backend viven en **ecosistema-ms**,
> no en welver. Welver no tiene pasarela de pagos propia.

### Dónde quedó implementado

| Qué | Repo | Archivo | Estado |
|-----|------|---------|--------|
| `marketing-backend` completo | ecosistema-ms | `marketing-backend/` | ✅ |
| `QUEUE_MARKETING_ATTRIBUTION` | ecosistema-ms | `pasarelapagos-backend/src/common/constants/queues.ts` | ✅ |
| Fire-forget en `WebhookProcessor` | ecosistema-ms | `pasarelapagos-backend/src/modules/webhooks/webhook.processor.ts` | ✅ |
| `MarketingClient` | superadmin | `grupojl-control-backend/src/common/integrations/marketing.client.ts` | ✅ |

### Qué corresponde a welver

Nada. El contrato está documentado en `.claude/contracts/marketing-integration.md`
como referencia de arquitectura, pero ningún archivo de welver fue modificado.

---

## PENDIENTE — Welver post-sesión 2026-09-19

- [ ] **Migración Prisma** — `pnpm prisma migrate dev --name add-superadmin-org-fields`
      ⚠️ BLOQUEANTE para deploy — aplica ecosystemId, plan, status, suspendedAt, storeStatus
- [ ] **INTERNAL_API_KEY** en Railway — mismo valor que ecosistema-ms y superadmin
- [ ] **make typecheck** → 0 errores
- [ ] **make g** → push a GitHub → Railway redeploy

---

## Sprint Markets — ADR-014

### sass-back (bloqueante para el resto)

- [x] MKT-01: Migración Prisma — `countryCode` en Organization + modelo Market
- [x] MKT-02: `market.entity.ts` con invariantes
- [x] MKT-03: `market.errors.ts`
- [x] MKT-04: `prisma-market.repository.ts`
- [x] MKT-05: `markets.service.ts` — `resolveMarket()` es el núcleo
- [x] MKT-06: `markets.router.ts` tRPC
- [x] MKT-07: Seed Market default al crear Organization
- [x] MKT-08: Unit tests resolveMarket()
- [x] MKT-09: Integration test tRPC

### ecommerce-back (depende de MKT-06)

- [x] MKT-E-01: tRPC client call a markets.resolve
- [x] MKT-E-02: Migración Order — marketId + visitorCountryCode + fulfillmentSnapshot
- [x] MKT-E-03: resolveVisitorCountry() util
- [x] MKT-E-04: X-Visitor-Country header en checkout
- [x] MKT-E-05: fulfillmentSnapshot inmutable en Order
- [x] MKT-E-06: Integration test checkout CO → Market CO

### ecommerce-front (depende de MKT-E-01)

- [x] MKT-F-01: useMarketStore Zustand
- [x] MKT-F-02: resolveVisitorCountry() en lib/market/resolver.ts
- [x] MKT-F-03: X-Visitor-Country en apiFetch interceptor
- [x] MKT-F-04: MarketBanner componente
- [x] MKT-F-05: Integrar en store-provider.tsx

### dashboard-front (depende de MKT-06)

- [ ] MKT-D-01: Página /dashboard/mercados
- [ ] MKT-D-02: Lista de Markets activos con fulfillmentConfig
- [ ] MKT-D-03: Crear/editar Market con selector de país ISO
- [ ] MKT-D-04: Toggle isActive con confirmación
