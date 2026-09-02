# Flujo del cliente en la tienda

## ¿Cómo llega un cliente a la tienda?

1. El cliente visita la URL de la tienda (ej: `tienda.com/tienda/mi-marca`)
2. El sistema detecta el slug (`mi-marca`) y busca a qué organización pertenece
3. Carga el tema visual de esa org (colores, logo, fuentes)
4. Muestra la tienda con los productos de esa organización

## Flujo de compra paso a paso

### 1. Navegar el catálogo
El cliente ve la grilla de productos. Puede filtrar por categoría, precio o
disponibilidad. Cada producto muestra foto, nombre, precio y si hay stock.

### 2. Ver el detalle de un producto
Al hacer clic en un producto ve las fotos en detalle, la descripción completa,
las variantes disponibles (talle, color) y cuántas unidades quedan.

### 3. Agregar al carrito
El cliente selecciona la variante y la cantidad. El carrito se abre como un
panel lateral mostrando lo seleccionado con el total.

### 4. Checkout
El cliente ingresa su email (para identificarse) y los datos de envío.
Confirma la compra. El sistema reserva el stock atómicamente para evitar
que dos personas compren la misma unidad al mismo tiempo.

### 5. Confirmación y seguimiento
El cliente recibe una confirmación y puede ver el estado de su pedido
en la página de tracking con el número de orden.

## Multi-tenant — cada tienda es independiente

El sistema puede tener miles de tiendas distintas corriendo al mismo tiempo.
Cada una tiene su propio slug, su propio catálogo y su propio diseño.
Los datos de una tienda nunca se mezclan con los de otra.

## Estado actual

✅ Flujo básico funcional.
⚠️ Integración de pagos real pendiente (hoy simula el pago).
⚠️ Integración de envíos pendiente (hoy devuelve opciones hardcodeadas).
