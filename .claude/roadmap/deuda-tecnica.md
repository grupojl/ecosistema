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

<!-- ADR-016-deuda -->
---

## SEO + idioma (ADR-016) — detectado 2026-09-22

### Bloqueantes (prerequisito del SEO)
- [ ] DT-SEO-01: sass-back no compila — `createForUserWithDefaultMarket` fuera de la clase, `MarketsService` sin inyectar
- [ ] DT-SEO-02: sass-back `findBySlug` sin `storeStatus` en el select → toda tienda en 404
- [ ] DT-SEO-03: storefront invoca procedures tRPC sin `.query()` → `resolveStore` siempre falla
- [ ] DT-SEO-04: páginas del storefront contra shape inexistente (`p.slug`, `p.priceCents`, `p.imageUrls`)
- [ ] DT-SEO-05: `catch {}` → `null` en data fetching → caída de backend = 404 masivo
- [ ] DT-SEO-06: `lib/store/index.ts` re-exporta `./types` inexistente

### Deuda consciente
- [ ] DT-SEO-07: quitar `ignoreBuildErrors: true` de `real-ecommerce-front/next.config.mjs`
- [ ] DT-SEO-08: `images.unoptimized: true` → LCP alto (requiere `remotePatterns` por tenant)
- [ ] DT-SEO-09: modelo `Product` sin imágenes → rich results incompletos
- [ ] DT-SEO-10: ruta legacy `/categoria/[categoria]` redirige a `/tienda/{categoria}` (categoría ≠ slug) y con 307, no 308
- [ ] DT-SEO-11: organizaciones existentes sin Market default → `resolveMarket` lanza NOT_FOUND
- [ ] DT-SEO-12: repomix no incluye `middleware.ts`, `lib/**/*.tsx`, `store/**` → auditorías ciegas

<!-- HARDENING-SEO-IDIOMA-2026-09-22 -->
---

## Hardening detectado en sesión SEO + idioma (2026-09-22)

Ninguno de estos 7 items fue causado por ADR-016/ADR-017 — se encontraron
al correr `tsc` real contra el código mientras se implementaba ese trabajo.
Cada uno tiene línea exacta y causa raíz confirmada contra el repo, no
sospecha.

### Bloqueantes de compilación

- [ ] **HARD-01** — `realsass-ecommerce-back/src/app.module.ts` línea 4:
      dos declaraciones `from` pegadas en una sola línea
      (`from './common/middleware/correlation-id.middleware'; ... from '@nestjs/common';`).
      Import corrupto, probablemente un merge mal resuelto.
- [ ] **HARD-02** — `realsass-ecommerce-back/src/organizations-client/organizations-client.service.ts`
      línea 96: una llave `}` de más cierra la clase `OrganizationsClientService`
      antes de `resolveMarket()`, que queda fuera de la clase — desincroniza
      el parser (34 errores en cascada, todos con el mismo origen).
- [ ] **HARD-03** — `packages/trpc/src/index.ts`: imports relativos con
      profundidad incorrecta (`../../` en vez de `../../../`) hacia
      `realsass-sass-back` y `realsass-ecommerce-back` — el paquete está a
      3 niveles de la raíz (`packages/trpc/src/`), no a 2.
- [ ] **HARD-04** — `packages/trpc/src/index.ts` línea 27: reexporta
      `{ t, router, publicProcedure }` desde `./server/trpc`, pero ese
      archivo exporta `createTRPCRouter`/`publicProcedure`/`protectedProcedure`
      — `t` y `router` no existen con esos nombres.
      **HARD-03 + HARD-04 explican en cascada** casi todos los errores de
      `trpc.customer.*`/`useUtils`/`Provider` en los 3 fronts: el tipo de
      `AppRouter` nunca resuelve, y `@trpc/react-query` devuelve su
      tipo-literal de advertencia en vez de las keys reales del router.

### `checkout()` — 3 bugs independientes en la misma función

- [ ] **HARD-05** — `realsass-ecommerce-back/src/orders/orders.service.ts`:
      `market` se usa (`market.id`, `market.fulfillmentConfig`) sin
      resolverse en ningún lado. Documentado desde antes en
      `MARKETS_CHECKOUT_PATCH.md` (ADR-014), nunca aplicado. Fix: resolver
      `market` vía `this.orgsClient.resolveMarket(organizationId,
      visitorCountryCode ?? 'default')` ANTES de abrir la transacción
      (es una llamada HTTP con cache Redis, no debe mantener una
      transacción de DB abierta).
- [ ] **HARD-06** — `customer.router.ts` llama
      `ordersService.checkout(ctx.organizationId!, {...})` (2 argumentos),
      pero el service siempre esperó **un solo objeto** con `organizationId`
      adentro.
- [ ] **HARD-07** — `orders.service.ts` escribe `sessionId` en
      `tx.order.create`, pero `Order` **no tiene esa columna** en
      `schema.prisma` — fallaría en Prisma. `Cart.sessionId` sí existe;
      evaluar si `Order` necesita duplicarlo o si sobra por completo.

### No relacionados a checkout, sin bloquear el resto

- [ ] **HARD-08** — `hooks/use-toast.ts`: `@real/ui` no exporta
      `ToastActionElement` ni `ToastProps`.
- [ ] **HARD-09** — `store/use-market-store.ts`: el tipo de `storage` en
      `persist()` de zustand no matchea `PersistStorage` (`getItem` devuelve
      `string | null`, se espera `StorageValue<MarketState> | null`).
      Nota: este archivo vive en `store/` (singular); el resto del proyecto
      usa `stores/` (plural, ver `stores/index.ts`) — el import
      `@/store/use-market-store` en `market-banner.tsx` y
      `api-fetch-with-market.ts` puede estar apuntando a un path que no
      coincide con la convención real del proyecto. Revisar si el archivo
      debe moverse a `stores/`.

### Orden sugerido

HARD-01 y HARD-02 primero (bloquean la compilación de todo el back).
Luego HARD-03/04 (desbloquea los 3 fronts de una sola vez). HARD-05/06/07
juntos (misma función). HARD-08/09 son independientes, sin apuro.
