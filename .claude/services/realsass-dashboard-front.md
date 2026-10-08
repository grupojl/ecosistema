# realsass-dashboard-front

## Rol

Dashboard de colaboradores (COLLABORATOR). Gestión operativa del negocio:
tienda, pedidos, chat IA, configuración.

## Le corresponde

- `/dashboard/tienda` — productos, pedidos, preview de tienda
- `/dashboard/configuracion` — flags, quotas, tema, webhooks (mismo dominio
  que sass-front pero desde la vista de colaborador)
- `/dashboard/chat` — conversaciones y proyectos IA (`chat-ia-back`, todavía
  sin router tRPC propio)
- `/dashboard/campanas`, `/dashboard/pagos` — placeholders, dominios
  pendientes de servicio propio
- `/dashboard/zonas` — redirect legacy (dominio real-estate descontinuado,
  categorías ahora se gestionan desde `/dashboard/tienda/productos`)

## Conecta con

- `realsass-sass-back` vía tRPC (`lib/trpc/client.ts`, tipos `SassAppRouter`) — cookie `__session` +
  `x-organization-id`
- `realsass-ecommerce-back` vía tRPC (`lib/trpc/ecommerce-client.ts`, tipos `EcommerceAppRouter`) —
  productos, stock y pedidos. Ambos clientes los monta `lib/trpc/provider.tsx` sobre el **mismo**
  `QueryClient` del `QueryProvider` (necesario para que el `HydrationBoundary` de los Server
  Components hidrate; las keys de prefetch están en `lib/trpc/keys.ts`)
- Servicios fuera del monorepo (campañas, pagos) vía `lib/api-client.ts` — **puente REST
  documentado**, deuda de ADR-005 (`NEXT_PUBLIC_CAMPANAS_URL`, `NEXT_PUBLIC_PAGOS_URL`)
- `chat-ia-back` vía fetch manual documentado (`lib/chat-ia-client.ts`) —
  **excepción explícita**: ese back todavía no tiene router tRPC. El archivo
  tiene TODO explícito para eliminarse cuando lo tenga.

## Contrato (ADR-019)

Todos los tipos de dominio salen de `@real/trpc` (`features/config/types.ts`, `features/store/types.ts`
usan `inferRouterInputs/Outputs`). `next.config.mjs` **no** ignora errores de tipos: `pnpm typecheck` y
`pnpm build` validan de verdad (2026-10-08: ambos en verde).

## Tienda (2026-10-08)

- Productos: tabla (estado, variantes, stock, precio), filtro por estado, búsqueda por nombre/handle/SKU,
  alta y edición en `components/dashboard/product-sheet.tsx`, stock por variante
  (`adminInventory.setStock`). "Eliminar" = **archivar** (el back no borra; `status: ARCHIVED`).
- Pedidos: filtro por estado (en el cliente) y detalle en `components/dashboard/order-sheet.tsx`
  (`adminOrders.get`), solo lectura.

## Bug/deuda conocida

- `features/chat`: coexisten `hooks.ts` y `hooks/`, `types.ts` y `types/`, con shapes distintos
  (el archivo gana sobre la carpeta al resolver). Los componentes `ConversationList`/`ChatWindow`/
  `ClientePanel` son presentacionales y no están montados en ninguna página. Falta decidir el shape
  único de chat-ia-back.
- `features/config-*/services/*.service.ts` son REST legacy sin uso (los hooks usan tRPC) — borrar.
- Eliminados el 2026-10-08: `features/store/api.ts` y los componentes iPhone/Mac de `components/dashboard/`.

`app/dashboard/chat/prueba/page.tsx` está deliberadamente aislado de
`features/chat/hooks` y `chat-ia-client.ts` para testing manual — no depende
de contratos internos que puedan cambiar. Es código de prueba, no de producto.

## UI — estado actual

Todos los componentes UI se importan desde `@real/ui`.
`components/ui/` fue eliminado — no existe más en este front.
`lib/utils.ts` re-exporta `cn` desde `@real/ui`.
Cliente tRPC usa `credentials: 'include'` — cookie __session viaja automáticamente.
