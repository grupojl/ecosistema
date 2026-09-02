# real-ecommerce-front — Tienda pública del cliente

## ¿Qué es en palabras simples?

Es la tienda que ven los clientes finales cuando visitan una tienda del ecosistema.
Cada organización tiene su propia tienda con su propio slug (nombre en la URL).
Por ejemplo: `misitienda.com/tienda/zapatillas-runner`.

A diferencia de los otros dos paneles (que son para el equipo interno),
esta pantalla está pensada para los compradores. No necesitan cuenta ni contraseña —
solo su email para identificarse al hacer una compra.

## ¿A quién está dirigido?

A los **clientes finales** de cada organización. Las personas que visitan
la tienda, navegan los productos y compran.

## Páginas principales

| Página | Ruta | Qué hace |
|---|---|---|
| Tienda principal | `/tienda/[slug]` | Landing de la tienda — featured, categorías |
| Catálogo | `/tienda/[slug]/productos` | Grilla de productos con filtros |
| Detalle de producto | `/tienda/[slug]/productos/[handle]` | Foto, descripción, variantes, agregar al carrito |
| Carrito | (drawer) | Resumen de lo seleccionado |
| Checkout | `/tienda/[slug]/checkout` | Datos de envío y confirmación de compra |
| Seguimiento | `/tienda/[slug]/tracking/[orderId]` | Estado del pedido |
| Rutas legacy | `/categoria/[cat]`, `/products/[handle]` | Pendientes de migrar a `/tienda/[slug]/` |

## Módulos que usa

- [store](../ecommerce-back/store.md) — para resolver a qué org pertenece la tienda
- [catalog](../ecommerce-back/catalog.md) — para mostrar los productos
- [inventory](../ecommerce-back/inventory.md) — para saber si hay stock disponible
- [cart](../ecommerce-back/cart.md) — para el carrito de compras
- [orders](../ecommerce-back/orders.md) — para el checkout y el historial
- [customers](../ecommerce-back/customers.md) — para identificar al comprador
- [config-themes](../sass-back/config-themes.md) — para aplicar el diseño de la marca

## Cómo se comunica con el back

Via tRPC — Server Components obtienen los datos antes de renderizar la página.
Los clientes no hacen fetch propio — rehidratan desde lo que el servidor ya trajo.

Excepción técnica documentada: `lib/store/client.ts` usa fetch REST manual
mientras se migran los procedures `customer.resolveStore` y `customer.identify`
en ecommerce-back.

## Cómo se identifica al cliente

Sin login clásico. El cliente ingresa su email y el sistema le asigna un
`customerId` que el navegador guarda. Con ese ID el sistema lo reconoce
en visitas futuras y muestra su historial de pedidos.

## Estado actual

✅ Funcional para catálogo, carrito y checkout básico.
⚠️ lib/store/client.ts pendiente de migrar a tRPC server caller.
⚠️ Rutas legacy /categoria/ y /products/ pendientes de migrar.
⚠️ Checkout — integración de pagos pendiente hasta pagos-back.
⚠️ Adapters de envío — stubs hasta integración con APIs de courier.
Zustand: useShoppingBagStore para el modal del carrito.
