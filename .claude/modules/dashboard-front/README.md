# realsass-dashboard-front — Panel de colaboradores

## ¿Qué es en palabras simples?

Es la herramienta de trabajo diario del equipo. Los colaboradores (empleados,
socios, encargados) entran acá para gestionar la tienda: cargar productos,
revisar pedidos, atender clientes, ver estadísticas y usar el chat IA.

A diferencia del panel del dueño (sass-front), este panel está pensado para
el trabajo operativo del día a día, no para la configuración de la cuenta.

## ¿A quién está dirigido?

A los **colaboradores** de una organización — personas que el dueño invitó
a gestionar el negocio con permisos específicos. También puede usarlo el
dueño si prefiere hacer el trabajo operativo desde acá.

## Páginas principales

| Sección | Ruta | Qué hace |
|---|---|---|
| Tienda — Productos | `/dashboard/tienda/productos` | CRUD de productos del catálogo |
| Tienda — Pedidos | `/dashboard/tienda/pedidos` | Ver y gestionar órdenes |
| Tienda — Preview | `/dashboard/tienda/preview` | Previsualizar la tienda pública |
| Configuración | `/dashboard/configuracion` | Flags, temas, webhooks (igual que sass-front) |
| Chat IA | `/dashboard/chat` | Conversaciones con el asistente de IA |
| Campañas | `/dashboard/campanas` | (Placeholder — módulo pendiente) |
| Pagos | `/dashboard/pagos` | (Placeholder — depende de pagos-back) |
| Login | `/login` | Inicio de sesión con Google |
| SSO | `/auth/sso` | Recibe el token del dueño y autautentica al colaborador |

## Módulos que usa

- [auth](../sass-back/auth.md) — para el login SSO y la sesión
- [collaborators](../sass-back/collaborators.md) — para verificar permisos
- [catalog](../ecommerce-back/catalog.md) — para gestionar productos
- [inventory](../ecommerce-back/inventory.md) — para el stock
- [orders](../ecommerce-back/orders.md) — para ver y gestionar pedidos
- [config-flags](../sass-back/config-flags.md) — para ver el estado de funciones
- [config-themes](../sass-back/config-themes.md) — para cambiar el tema
- [config-webhooks](../sass-back/config-webhooks.md) — para gestionar webhooks

## Cómo se comunica con el back

Exclusivamente vía tRPC. Conecta con sass-back y ecommerce-back.
La cookie de sesión viaja automáticamente.
Excepción documentada: `lib/chat-ia-client.ts` usa fetch manual porque
chat-ia-back todavía no tiene router tRPC.

## Estado actual

✅ Funcional. TanStack Query en todas las páginas de datos.
Zustand: useSidebarStore para el sidebar mobile.
⚠️ lib/firebase.ts pendiente de eliminar (migrar callers a @real/auth-client).
