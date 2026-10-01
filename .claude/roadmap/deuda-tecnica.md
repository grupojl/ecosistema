# Deuda técnica — welver

Última actualización: 2026-09-28

---

## Cerrado en sesión 2026-09-19 ✅

- [x] InternalModule con pause-store/resume-store en realsass-sass-back
- [x] Prisma schema limpio (OrgStatus + StoreStatus solo en Organization)
- [x] ecommerceEnabled: org.storeStatus === 'ACTIVE'
- [x] GET /organizations/public/by-slug/:slug expuesto

---

## Cerrado en sesión 2026-09-28 ✅ — Audit de tipado + Hardening

### Tipado (ADR-007)

- [x] **HARD-01** — `realsass-ecommerce-back/src/app.module.ts` — import duplicado corregido
- [x] **HARD-02** — `organizations-client.service.ts` — `}` de más antes de `resolveMarket()` corregido
- [x] **HARD-03** — `packages/trpc/src/index.ts` — paths relativos con profundidad incorrecta corregidos
- [x] **HARD-04** — `packages/trpc/src/index.ts` — exports `t`/`router` inexistentes corregidos a `createTRPCRouter`/`publicProcedure`/`protectedProcedure`
- [x] **HARD-05** — `orders.service.ts` — `market` resuelto vía `orgsClient.resolveMarket()` antes de la transacción
- [x] **HARD-06** — `customer.router.ts` — firma de `checkout()` corregida a objeto único con `organizationId`
- [x] **HARD-07** — `orders.service.ts` — `sessionId` eliminado de `order.create` (columna no existe en schema)
- [x] **HARD-08** — `use-toast.ts` en 3 fronts — `ToastProps`/`ToastActionElement` definidos localmente
- [x] **HARD-09** — `use-market-store.ts` — `createJSONStorage` + movido a `stores/` (plural)
- [x] `packages/auth-client` — `tsconfig.json` con `skipLibCheck: true` + `firebase.ts` usa `env()` helper con `globalThis`
- [x] `packages/trpc/src/server/trpc.ts` — `superjson` transformer agregado
- [x] Spec files — comentarios `// @real/jsonb-cast` en medio de expresiones reemplazados por `/* */`
- [x] 30+ `as any` y `as unknown as` reemplazados por tipos reales del ecosistema
- [x] `PrismaTransactionClient` — tipo propio exportado desde `prisma.service.ts` que refleja la realidad del adaptador PG — elimina 3 casteos en `orders.service.ts`
- [x] `InventoryService.reserveWithinTransaction` — migrado a `PrismaTransactionClient`
- [x] `instanceof ZodError` en ambos `trpc.ts` — elimina doble cast `as unknown as ZodError`
- [x] `jest.spyOn(globalThis, 'fetch')` en `store.service.spec.ts` — elimina `global.fetch = fn as unknown as typeof fetch`
- [x] `orders.service.spec.ts` — reescrito con `Test.createTestingModule` con los 5 providers correctos
- [x] `catalog.service.spec.ts` — `validDto` tipado como `CreateProductDto`, `UpdateProductPatch` directo
- [x] `markets.integration.spec.ts` — mock tipado como `jest.Mocked<MarketsService>` sin cast
- [x] `ApiEnvelope.data` — marcado opcional (`data?: T`) eliminando cast en `api-fetch.ts`
- [x] `json-ld.spec.ts` — `as any` → `as JsonLdObject` (tipo ya exportado en `json-ld.ts`)

### Audit B — estado post sesión 2026-09-28

```
B1  as any sin @real/         → ✅ 0 hallazgos reales
B1b : any en parámetros       → ✅ 0 hallazgos reales
B2  as unknown as sin @real/  → ✅ 0 hallazgos reales
B3  @ts-ignore                → ✅ 0
B4  @ts-expect-error          → ✅ 0
B5  class-validator           → ✅ 0
B6  strict: true              → ✅ activo

D1  as any @real/browser-compat → ⚠ 1 (firebase.ts — inevitable sin @types/node en package browser)
D2  as unknown as @real/        → ✅ 0
D3  @real/jsonb-cast repository → ✅ 0
D4  @real/jsonb-cast fuera repo → ✅ 0
```

---

## Pendiente activo — P0 para producción

### [WEL-01] Migración Prisma — BLOQUEANTE
```bash
cd realsass-sass-back
pnpm prisma migrate dev --name add-superadmin-org-fields
cd ../realsass-ecommerce-back
pnpm prisma migrate dev --name add_market_fields_to_order
```
Sin esta migración, el deploy en Railway falla al arrancar.

### [WEL-02] INTERNAL_API_KEY en Railway
Variable de entorno en realsass-sass-back.
Sin esto, grupojl-control recibe 403 en /internal/organizations.

### [WEL-03] pnpm prisma generate en ambos backs
```bash
cd realsass-ecommerce-back && pnpm prisma generate && cd ..
cd realsass-sass-back && pnpm prisma generate && cd ..
```
Sin esto, `pnpm typecheck` falla en los repositories por Prisma Client no generado.

---

## Pendiente activo — P1

### [WEL-04] HydrationBoundary en dashboard-front
- realsass-dashboard-front/app/dashboard/tienda/productos/page.tsx
- realsass-dashboard-front/app/dashboard/tienda/pedidos/page.tsx
Patrón documentado en .claude/decisions/ADR-009.

### [WEL-05] GitHub Actions — 7 workflows
Documentados en .claude/decisions/ADR-013.
Trigger: antes de onboardear al primer colaborador externo.

### [WEL-06] Branch protection en GitHub
### [WEL-07] OTEL_EXPORTER_OTLP_ENDPOINT en Railway

---

## Deuda conocida — no urgente

- `checkout.controller.ts` — paymentIntentId en null hasta pagos-back
- Storefront pages /tienda/[slug]/ con JSX inline — pendiente design system
- `firebase.ts` — `(globalThis as any /* @real/browser-compat */).process` — inevitable sin @types/node en package browser. Fix alternativo: eliminar auto-init y obligar a los fronts a llamar `initFirebase(config)` explícitamente desde Next.js — puntuado 9/10.

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
- [ ] Migraciones Prisma en sass-back + ecommerce-back (requiere DB) — ver WEL-01

---

## Observabilidad ✅ COMPLETADA 2026-09-21

- [x] OBS-W-01..09 — LoggerModule, PrometheusModule, CorrelationId, Health checks, CI

---

## SEO + idioma (ADR-016) — detectado 2026-09-22

### Bloqueantes (prerequisito del SEO)
- [ ] DT-SEO-01: sass-back `createForUserWithDefaultMarket` fuera de la clase
- [ ] DT-SEO-02: `findBySlug` sin `storeStatus` en el select → toda tienda en 404
- [ ] DT-SEO-03: storefront invoca procedures tRPC sin `.query()` → `resolveStore` siempre falla
- [ ] DT-SEO-04: páginas del storefront contra shape inexistente (`p.slug`, `p.priceCents`, `p.imageUrls`)
- [ ] DT-SEO-05: `catch {}` → `null` en data fetching → caída de backend = 404 masivo
- [ ] DT-SEO-06: `lib/store/index.ts` re-exporta `./types` inexistente

### Deuda consciente
- [ ] DT-SEO-07: quitar `ignoreBuildErrors: true` de `real-ecommerce-front/next.config.mjs`
- [ ] DT-SEO-08: `images.unoptimized: true` → LCP alto
- [ ] DT-SEO-09: modelo `Product` sin imágenes → rich results incompletos
- [ ] DT-SEO-10: ruta legacy `/categoria/[categoria]` con 307 en vez de 308
- [ ] DT-SEO-11: organizaciones sin Market default → `resolveMarket` lanza NOT_FOUND
- [ ] DT-SEO-12: repomix no incluye `middleware.ts`, `lib/**/*.tsx`, `store/**`
