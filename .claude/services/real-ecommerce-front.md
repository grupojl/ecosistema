# real-ecommerce-front

## Rol

Storefront público multi-tenant, SSG/ISR. Sin Firebase — clientes se
identifican por `customerId` (via `POST /customers/identify`) + `sessionId`
en localStorage.

## Le corresponde

- `/tienda/[slug]/*` — ruta canónica multi-tenant (organizationId resuelto
  dinámicamente desde el slug, NO hardcodeado por env var)
- `/categoria/[categoria]`, `/products/[handle]` — rutas legacy sin contexto
  de tienda, **pendientes de migrar** a `/tienda/[slug]/`
- `/checkout`, `/tracking` — flujo de compra y seguimiento

## Conecta con

- `realsass-ecommerce-back` vía tRPC (customer context) para carrito/perfil/órdenes
- `realsass-ecommerce-back` vía REST público (`lib/store/client.ts`,
  `lib/store/resolver.ts`) para resolver slug y listar productos/categorías —
  documentado como Server Components safe, sin auth

## Estado de migración (gap conocido, documentado en el propio código)

`lib/ecommerce/index.ts` es un **shim de compatibilidad**: re-exporta desde
`lib/store/` (cliente canónico, multi-tenant real) para no romper las páginas
legacy bajo `/categoria/` y `/products/` que todavía importan de `@/lib/ecommerce`.
TODO explícito en el archivo: migrar esas páginas y eliminar `lib/ecommerce/`.

`getAllProducts()` en ese shim devuelve array vacío a propósito — no tiene
`organizationId` disponible en el contexto legacy.

## Mocks pendientes de eliminar (capa 4, presentación)

- `components/checkout/checkout-flow.tsx` — simula autenticación WebAuthn
- `lib/services/shipping-service.ts` / `lib/adapters/*-adapter.ts` — adapters
  de shipping (Correo/Envia/Welivery) son stubs con pricing mockeado

## UI — estado actual

Todos los componentes UI se importan desde `@real/ui`.
`components/ui/` fue eliminado — no existe más en este front.
`lib/utils.ts` re-exporta `cn` desde `@real/ui`.
