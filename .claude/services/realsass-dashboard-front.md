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

- `realsass-sass-back` vía tRPC — Bearer Firebase token + `x-organization-id`
- `realsass-ecommerce-back` vía tRPC — para productos/pedidos
- `chat-ia-back` vía fetch manual documentado (`lib/chat-ia-client.ts`) —
  **excepción explícita**: ese back todavía no tiene router tRPC. El archivo
  tiene TODO explícito para eliminarse cuando lo tenga.

## Bug/deuda conocida

`app/dashboard/chat/prueba/page.tsx` está deliberadamente aislado de
`features/chat/hooks` y `chat-ia-client.ts` para testing manual — no depende
de contratos internos que puedan cambiar. Es código de prueba, no de producto.

## UI — estado actual

Todos los componentes UI se importan desde `@real/ui`.
`components/ui/` fue eliminado — no existe más en este front.
`lib/utils.ts` re-exporta `cn` desde `@real/ui`.
Cliente tRPC usa `credentials: 'include'` — cookie __session viaja automáticamente.
