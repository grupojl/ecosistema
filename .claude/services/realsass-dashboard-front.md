# realsass-dashboard-front

## URLs (ADR-022)

El panel vive en la raíz: `/` es el inicio, `/tienda/productos`, `/tienda/pedidos`, `/configuracion/…`, `/chat`, etc. (carpeta `app/(panel)`, un grupo de rutas que no aparece en la URL). `/dashboard/**` redirige con 308 a `/**`. En desarrollo: `pnpm dev:webpack` si Turbopack falla en Windows.

## Rol

Dashboard de colaboradores (COLLABORATOR). Gestión operativa del negocio:
tienda, pedidos, chat IA, configuración.

## Le corresponde

- `/tienda` — productos, pedidos, preview de tienda
- `/configuracion` — flags, quotas, tema, webhooks (mismo dominio
  que sass-front pero desde la vista de colaborador)
- `/chat` — conversaciones y proyectos IA (`chat-ia-back`, todavía
  sin router tRPC propio)
- `/campanas`, `/pagos` — placeholders, dominios
  pendientes de servicio propio
- `/zonas` — redirect legacy (dominio real-estate descontinuado,
  categorías ahora se gestionan desde `/tienda/productos`)

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

## WhatsApp (ADR-025)

La conexión del WhatsApp de la organización **no se hace acá**: por ahora se autoriza en el panel del dueño (`realsass-sass-front`, `/profile/config`). Este dashboard no tiene esa pantalla. Ver `decisions/ADR-025-whatsapp-embedded-signup-sass-front.md`.

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

## Dos clientes tRPC, dos contextos

`lib/trpc/provider.tsx` anida `trpc.Provider` (sass-back) y `ecommerceTrpc.Provider` (ecommerce-back). En tRPC v11
todos los `createTRPCReact` comparten el mismo `TRPCContext` por defecto: el provider interno pisaba al externo
y las consultas `trpc.*` iban al ecommerce-back (404 "No procedure found"). `ecommerceTrpc` se crea con
`{ context: createContext(null) }`. **Todo cliente tRPC React nuevo en un front con más de un back necesita su
propio contexto.**

## Dispositivos (ADR-020) ✅

Menú de usuario del sidebar → "Dispositivos" abre un modal (`DevicesDialog` de `@real/ui`, conectado en
`components/devices-dialog-connected.tsx`): lista (`sessions.list`), marca "Este dispositivo", "Cerrar"
por sesión y "Cerrar las demás". Solo consulta con el modal abierto.

## Turbopack: `0xc0000142` al compilar `globals.css` (Windows)

Síntoma: `An unexpected Turbopack error occurred`. El log de pánico (`%TEMP%\next-panic-*.log`) dice `Failed to write app endpoint ... globals.css ... evaluate_webpack_loader ... node process exited before we could connect to it with exit code: 0xc0000142`: Turbopack no logra lanzar el proceso hijo de PostCSS. Es del entorno (no del código: la config de PostCSS es idéntica en los 3 fronts). Alternativa: `pnpm dev:webpack` (`next dev -p 3022 --webpack`), que procesa el CSS dentro del mismo proceso.

## Cache-Control de `/_next/static`

`next.config.mjs` fuerza `public, max-age=31536000, immutable` **solo en producción** (los archivos llevan hash). En dev no: ahí el navegador se
quedaba con JavaScript viejo por un año y Next avisaba "Custom Cache-Control headers ... can break Next.js development behavior".

## Bug/deuda conocida

- `features/chat`: coexisten `hooks.ts` y `hooks/`, `types.ts` y `types/`, con shapes distintos
  (el archivo gana sobre la carpeta al resolver). Los componentes `ConversationList`/`ChatWindow`/
  `ClientePanel` son presentacionales y no están montados en ninguna página. Falta decidir el shape
  único de chat-ia-back.
- `features/config-*/services/*.service.ts` son REST legacy sin uso (los hooks usan tRPC) — borrar.
- Eliminados el 2026-10-08: `features/store/api.ts` y los componentes iPhone/Mac de `components/dashboard/`.

`app/chat/prueba/page.tsx` está deliberadamente aislado de
`features/chat/hooks` y `chat-ia-client.ts` para testing manual — no depende
de contratos internos que puedan cambiar. Es código de prueba, no de producto.

## UI — estado actual

Todos los componentes UI se importan desde `@real/ui`.
`components/ui/` fue eliminado — no existe más en este front.
`lib/utils.ts` re-exporta `cn` desde `@real/ui`.
Cliente tRPC usa `credentials: 'include'` — cookie __session viaja automáticamente.
