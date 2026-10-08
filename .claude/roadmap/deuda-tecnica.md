# Deuda técnica — welver

Última actualización: 2026-10-08

---

## Sesión 2026-10-08 — Contratos desde `dist` + dashboard-front (ADR-019)

### Cerrado ✅

- [x] **`@real/trpc` con contrato real**: `build` emite los `.d.ts` de ambos backs a `dist/contracts/`; se
  eliminó el stub `SassAppRouter = any`. Hoja `@real/trpc/markets` para que los backs no dependan del contrato.
- [x] **Sin `any` en procedures** (`trpc.ts` de sass-back y ecommerce-back): builders anotados con
  `TRPCProcedureBuilder` + contextos con nombre (evita TS2883).
- [x] DTO de templates y webhooks pedían `organizationId` al cliente (lo inyecta el service) — tipados con `Omit`.
- [x] Router de temas de sass-back: `list` / `create` / `activate` / `remove` (antes `list` devolvía un tema y
  `update` solo activaba).
- [x] `packages/auth-client`: `api-fetch.ts` sin alias `@/`; `getFirebaseAuth` exportado.
- [x] `pnpm install` roto: se quitó `@nestjs-modules/ioredis@^3.0.0` (versión inexistente, sin uso en `src`) y se
  declaró `@types/qs` en ecommerce-back.
- [x] **realsass-dashboard-front: typecheck y build en verde, sin `ignoreBuildErrors`.**
  - módulo Tienda migrado a tRPC (`features/store/hooks.ts`), con alta/edición de producto, stock por variante
    y detalle de pedido;
  - páginas de config alineadas al contrato (flags, quotas, tema, webhooks);
  - `auth-context.tsx` tenía `'use client'` en la línea 6 (rompía el build);
  - eliminados `features/store/api.ts` y 4 componentes iPhone/Mac huérfanos.

### Cerrado en la segunda mitad de la sesión ✅

- [x] **[DT-CONTRATO-01] Docker de los fronts**: stage `contracts` en los 3 Dockerfiles + `.dockerignore` raíz.
  Verificado simulando los stages en un directorio limpio (los 3 fronts).
- [x] **[DT-CONTRATO-02] CI**: script raíz `pnpm contracts`, ejecutado tras `pnpm install` en los 15 workflows.
- [x] **[DT-CONTRATO-03] `sass-front` y `real-ecommerce-front`**: typecheck y build en verde contra el contrato
  real; `ignoreBuildErrors` eliminado de `real-ecommerce-front` (= DT-SEO-07). Archivos truncados
  (`navbar.tsx`, `auth-provider-wrapper.tsx` sin la `}` final), `useAuth`/perfil, carrito (`customer.cart.*`) y
  markets alineados al contrato.
- [x] **[DT-CONTRATO-04] `configThemes.getPublicTheme`**: procedure público por `orgSlug` en sass-back.
- [x] `@real/auth-client`: `signInWithApple`, `signInWithFacebook`.
- [x] Bug latente: `collaborators.service.ts` usaba `import("@prisma/client").Prisma` (cliente por defecto que
  no existe: el schema genera en `src/generated/prisma`); solo compilaba por un `@prisma/client` viejo local.
- [x] Docker de los backs: `CMD ["dumb-init", …]` tenía un `]` suelto (ejecutaba una ruta inexistente).

### Cerrado — build de fronts y variables de entorno ✅

- [x] `real-ecommerce-front`: `middleware.ts` → `proxy.ts` (Next 16), comportamiento verificado (307 con
  `Vary`, `Cache-Control` y `X-Locale-Source`).
- [x] `SITE_URL`: `robots.ts` pasó a `force-dynamic`; `ARG/ENV SITE_URL` en el Dockerfile para el build;
  verificado que `robots.txt` agrega `Sitemap:` leyendo la variable en runtime.
- [x] `realsass-sass-front` no tenía `output: 'standalone'` pero su Dockerfile copia `.next/standalone`
  (la imagen no podía construirse). Corregido y verificado arrancando `server.js` en los 3 fronts.
- [x] Dockerfile del dashboard no declaraba `NEXT_PUBLIC_REAL_BACK_URL`, `CHAT_IA_URL`, `CAMPANAS_URL`, `PAGOS_URL`
  (quedaban `undefined` en el build); storefront: `ORGANIZATION_ID` y `SITE_URL`.
- [x] `.env.example` completo (con comentarios, requerida/opcional y defaults reales) en los 5 servicios.
  `real-ecommerce-front/.gitignore` ignoraba `.env*` incluido el example (nunca estuvo versionado).
- [x] `next dev` de los 3 fronts usaba el puerto 3000 (choque con sass-back): ahora 3001 / 3002 / 3003.
- [x] Comentario obsoleto `SESSION_COOKIE_SECRET` en el Dockerfile de sass-back (el código no la lee).

### Cerrado — errores de Railway y de arranque de los contenedores ✅ (2026-10-08)

El primer deploy en Railway falló en los 5 servicios con `dockerfile invalid: flag '--mount=type=cache,id=…' is
missing the cacheKey prefix`. Corregirlo destapó fallos que solo se ven al ejecutar la imagen; se reprodujeron
emulando el runtime del Dockerfile (`node_modules` un nivel arriba) y se verificaron después del arreglo:

- [x] **Cache mounts de pnpm**: Railway exige `id=s/<id-del-servicio>-…` y un Dockerfile no conoce ese id. Se quitaron
  los 8 `RUN --mount=type=cache` (5 servicios + 3 stages `contracts`); el build reinstala dependencias cada vez.
  Las plantillas `architecture/05-dockerfile-backend.md` y `06-dockerfile-frontend.md` todavía los muestran
  (contratos inmutables: no se tocaron).
- [x] **Backs — `entrypoint.sh`** usaba `node_modules/.bin/prisma` pero `node_modules` está en `/app/node_modules`:
  ahora agrega `../node_modules/.bin` al PATH. Reproducido (`No such file or directory`) y verificado.
- [x] **Backs — `prisma.config.ts`** no se copiaba al runtime (con Prisma 7 la URL de la base sale de ese archivo).
- [x] **Backs — `entrypoint.sh` no ejecutable** (modo git 100644): el `CMD` lo invoca con `sh`.
- [x] **sass-back no arrancaba** (nunca había corrido compilado): `AuthModule` no importaba `AffiliatesModule`;
  `TrpcModule` no importaba `ConfigTemplatesModule` ni `AffiliatesModule`; se perdió `BullModule.forRoot`.
  Ahora: "Nest application successfully started" desde el layout de la imagen.
- [x] ecommerce-back verificado: arranca desde el layout de la imagen ("Nest application successfully started").

### Pendiente — variables de entorno

- [ ] [DT-ENV-01] dashboard: el back de sass se llama `NEXT_PUBLIC_REAL_BACK_URL` en layout/provider/constants y
  `NEXT_PUBLIC_SASS_BACK_URL` en `api-client`/`providers`. Hoy hay que definir ambas. Unificar en `SASS_BACK_URL`.
- [x] [DT-ENV-02] **Cerrado**: sass-back no arrancaba (`Worker requires a connection`) porque se había perdido el
  `BullModule.forRoot`; restaurado en `AppModule` leyendo `REDIS_URL` (`src/redis/bull-connection.ts`).
  Sigue haciendo falta un Redis real para los webhooks: no se probó contra uno.
- [ ] [DT-ENV-03] storefront: `x-organization-id` del navegador sale de una variable fija; no sirve para varias
  tiendas en un mismo despliegue. Resolver la organización por slug (ya la entrega `customer.resolveStore`).
- [ ] [DT-ENV-04] ecommerce-back: la imagen usa `PORT=3001` y local `3005`; alinear.
- [ ] [DT-ENV-05] `realsass-dashboard-front/.env.local.example` y `realsass-sass-front/.env.local.example` quedaron
  duplicados y desactualizados (mencionan servicios inexistentes y `/api/v1` en las URLs): borrarlos.

### Pendiente — P0

- [ ] **[DT-TEST-01] Los tests de los backs no se pueden ejecutar** (verificado 2026-10-08): `pnpm test` falla porque cada back
  tiene `jest.config.js` **y** la clave `jest` en `package.json` ("Multiple configurations found"); con
  `--config jest.config.js` las 16 suites (8 por back) fallan sin correr un solo test por TS5011 (TypeScript 6 exige
  `rootDir` en ts-jest). Es previo a la sesión del ADR-019. Prerrequisito de S4-E (tests de backend).
- [ ] **[DT-DOCKER-01] `docker build` real** de los 3 fronts y de los 2 backs. Lo verificado hasta ahora son los
  comandos de cada stage y el arranque del runtime emulado, sin Docker. Railway valida la sintaxis (ya mostró un error).

### Pendiente — P1

- [ ] [DT-CI-01] `ci-*-front.yml` corren `lint` y `build`; el lint de los fronts no se verificó.
- [ ] [DT-CI-02] Hay 15 workflows con jobs duplicados (`ci-*` y `realsass-*`/`trpc-contract`): unificar en los 7 documentados.
- [ ] [DT-SF-01] `sass-front`: `UserProfile.isOwner` no existe en el contrato; "dueño" se deriva de
  `profile.organization !== null`. Confirmar la regla.
- [ ] [DT-DASH-01] ecommerce-back: procedure para editar variantes (SKU/precio) y para cambiar el estado de un
  pedido; el dashboard no puede hacerlo hoy.
- [ ] [DT-DASH-02] `features/chat`: unificar `hooks.ts`/`hooks/` y `types.ts`/`types/` en un único shape de
  chat-ia-back; hoy conviven tres.
- [ ] [DT-DASH-03] Borrar `features/config-*/services/*.service.ts` (REST legacy sin uso) y migrar `campanas` /
  `pagos` fuera de `lib/api-client.ts` cuando esos servicios tengan router tRPC.
- [ ] [DT-DASH-04] Permisos finos por colaborador (ver `modules/dashboard-front/tienda.md`) sin cablear en las
  pantallas de Tienda.

### Deuda consciente

- `MarketDTO` duplicado en `packages/trpc/src/markets.ts` y la entidad de sass-back.
- Los tipos de fecha del contrato dicen `Date` pero viajan como string (cliente tRPC sin transformer).
- `src/generated/` (cliente Prisma) de ambos backs no está en `.gitignore`.
- Los `.d.ts` de contratos dejan `@nestjs/*`, `express` y `@prisma/client-runtime-utils` sin resolver en los fronts
  (resuelven a `any` solo fuera de la salida de los routers).

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
