# real-ecommerce-front

## Rol

Storefront público multi-tenant, SSG/ISR con Next.js 15 App Router.
Sin Firebase — clientes se identifican por `customerId` + `sessionId`.

## Modelo de rendering (canónico)

```
Server Component (page.tsx, layout.tsx)
  → tRPC server caller para obtener datos
  → renderiza HTML con datos
  → pasa initialData a Client Components via props/HydrationBoundary

Client Component ('use client')
  → rehidrata con useQuery() misma queryKey
  → NUNCA hace fetch propio al back
```

El único fetch manual permitido es `customer.identify` para obtener el
`customerId` inicial — es el bootstrap del contexto de cliente, equivalente
a lo que hace `POST /auth/session` para el sistema de auth de owners.

## Le corresponde

- `/tienda/[slug]/*` — ruta canónica multi-tenant
- `/categoria/[categoria]`, `/products/[handle]` — rutas legacy, pendientes de migrar
- `/checkout`, `/tracking` — flujo de compra y seguimiento

## Conecta con

- `realsass-ecommerce-back` **únicamente vía tRPC** — `EcommerceAppRouter`
  - Server Components: `createServerCaller()` → procedures de `customer.*`
  - Client Components: `trpc.customer.*` hooks (rehidratación)

## Configuración (2026-10-08)

- `proxy.ts` (antes `middleware.ts`) negocia el idioma de `/tienda/*`; ver `modules/ecommerce-front/seo-i18n.md`.
- `SITE_URL` es de **runtime**. `app/robots.ts` es `force-dynamic` para leerla por request (antes se
  prerenderizaba en el build y, sin la variable, `robots.txt` quedaba sin la línea `Sitemap`).
- No usa Firebase ni `@real/auth-client`: el cliente se identifica por email (`customer.identify`).
- `NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID` es la única fuente del header `x-organization-id` del navegador;
  los procedures de carrito y checkout lo exigen (limitación para multi-tienda, DT-ENV-03).
- Variables completas en `.env.example`.

## Estado de migración pendiente

- `lib/store/client.ts` — fetch REST manual a eliminar → reemplazar por tRPC server caller
- `lib/store/resolver.ts` — `resolveStore()` via REST → reemplazar por `trpc.customer.resolveStore`
- `lib/ecommerce/index.ts` — shim legacy → eliminar cuando migren páginas `/categoria/` y `/products/`
- `context/customer-context.tsx` — usa `identifyCustomer()` via REST → migrar a `trpc.customer.identify`

## Mocks pendientes (capa 4, presentación)

- `components/checkout/checkout-flow.tsx` — simula WebAuthn, bloqueado hasta `pagos-back`
- `lib/services/shipping-service.ts` / `lib/adapters/*` — stubs, bloqueado hasta APIs courier

## UI

Todos los componentes desde `@real/ui`. `lib/utils.ts` re-exporta `cn` desde `@real/ui`.
