# Carrito de compras

## ¿Qué hace en palabras simples?

El carrito guarda los productos que el cliente quiere comprar antes de confirmar
el pedido. Se muestra como un panel lateral que aparece desde la derecha cuando
el cliente agrega algo.

## Comportamiento

- **Persistente**: si el cliente cierra el navegador y vuelve, sus productos
  siguen en el carrito. El ID del carrito se guarda en el navegador.
- **Multi-producto**: puede tener productos de distintas variantes y cantidades.
- **Actualizable**: el cliente puede cambiar cantidades o quitar productos
  antes de confirmar.
- **Sin login**: el cliente no necesita estar identificado para usar el carrito.
  Solo necesita loguearse (con email) al momento del checkout.

## Estado en la UI

El ícono del carrito en el navbar muestra la cantidad de ítems.
Al hacer clic se abre el drawer lateral con el detalle.

El estado open/close del carrito vive en `useShoppingBagStore` (Zustand).
El contenido del carrito (productos, cantidades, totales) vive en TanStack Query.

## Estado actual

✅ Funcional. Persistencia por cartId en localStorage del navegador.
