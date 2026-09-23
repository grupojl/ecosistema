# ecommerce-back — SEO + idioma (ADR-016)

**Rol:** CONSUMER de `StoreInfo` (sass-back) y PROVIDER de `customer.*` para el
storefront. Responsable de que el storefront pueda distinguir **404** de **5xx**.

## Invariantes

- La respuesta HTTP de sass-back es **input no confiable** → Zod, nunca `as`.
- Tolerant reader: `countryCode` ausente/inválido → `'AR'` (soporta rollback de sass-back).
- 404 **solo** cuando la tienda no existe o está pausada. Toda falla de
  infraestructura → `SERVICE_UNAVAILABLE`.

## Checklist

- [x] **SEO-EB-01** — `src/store/store.contract.ts`: `StoreInfoSchema` (Zod) +
      `parseSassBackStoreResponse()` que acepta `{ success, data }` o plano.
- [x] **SEO-EB-02** — `src/store/store.service.ts`: red/timeout/5xx/contrato inválido/
      `SASS_BACK_URL` vacío → `ServiceUnavailableException`; 404 y
      `ecommerceEnabled:false` → `NotFoundException`.
- [x] **SEO-EB-03** — `src/store/store.trpc-errors.ts`: `rethrowAsTrpcStoreError()`
      (Nest `HttpException` → `NOT_FOUND` / `SERVICE_UNAVAILABLE` / `INTERNAL_SERVER_ERROR`).
      Sin esto tRPC convierte todo en `INTERNAL_SERVER_ERROR`.
- [x] **SEO-EB-04** — `customer.router.ts → resolveStore`:
      `storeService.resolveBySlug(input.slug).catch(rethrowAsTrpcStoreError)`.
- [x] **SEO-EB-05** — Specs: `store.service.spec.ts` (contrato + 7 escenarios de
      error) y `store.trpc-errors.spec.ts`.

## Verificación

```bash
pnpm --filter realsass-ecommerce-back exec tsc --noEmit
pnpm --filter realsass-ecommerce-back test -- store
```

## Deploy

Segundo. `@real/trpc` importa el tipo `EcommerceAppRouter` desde este servicio:
el storefront hereda `countryCode` en `StoreInfo` sin duplicar tipos (ADR-007).

<!-- ADR-017-EXTENSION -->
---

## Extensión — Order.locale (ADR-017, 2026-09-22)

- [x] **EB-06** — `schema.prisma`: `Order.locale` (`String?`, nulo válido)
- [x] **EB-07** — `checkout()` acepta y persiste `locale`
- [x] **EB-08** — `customer.router.ts`: `locale` validado con Zod (2-10 chars) y reenviado

**Alcance acotado a propósito:** no se tocaron HARD-05/06/07 (`market` sin
resolver, arity de la llamada, `sessionId` fantasma) — misma función,
bugs preexistentes, van a hardening. Consecuencia: `checkout()` no ejecuta
hoy. Ver `roadmap/deuda-tecnica.md`.

## Verificación

```bash
pnpm --filter realsass-ecommerce-back prisma migrate dev --name add_order_locale
pnpm --filter realsass-ecommerce-back exec tsc --noEmit
```

`tsc` va a fallar por HARD-01/02 (bugs preexistentes en `app.module.ts` y
`organizations-client.service.ts`) — ninguno de este cambio.
