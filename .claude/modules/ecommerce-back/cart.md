# Módulo: cart (carrito de compras)

## ¿Qué hace en palabras simples?

Es el carrito virtual. Permite a los clientes agregar productos, quitarlos
y ver el total antes de confirmar la compra. El carrito persiste entre sesiones —
si el cliente cierra el navegador y vuelve, sus productos siguen ahí.

## ¿Qué problemas resuelve?

- "Quiero agregar este producto al carrito" → agrega o incrementa cantidad
- "Me arrepentí, saco este producto" → elimina del carrito
- "¿Qué tengo en el carrito?" → devuelve el contenido con precios actualizados
- "Cerré el navegador y volví, ¿dónde está mi carrito?" → persistencia por cartId

## Funciones principales

- **getCart**: devuelve el contenido del carrito con productos, variantes, cantidades y totales.
- **addItem**: agrega una variante de producto al carrito (o incrementa la cantidad si ya está).
- **removeItem**: quita una variante del carrito.
- El carrito se identifica por un `cartId` que el front guarda en el navegador.

## ¿Quién lo usa?

- La tienda pública (ecommerce-front) — el cliente usa el carrito al comprar

## Estado actual

✅ Funcionando. El cartId se guarda en localStorage del navegador del cliente.
