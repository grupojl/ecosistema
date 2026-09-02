# Módulo: orders (pedidos y checkout)

## ¿Qué hace en palabras simples?

Convierte el carrito en un pedido real. Cuando el cliente confirma la compra,
este módulo reserva el stock, crea el pedido y registra los detalles. Los
dueños y colaboradores pueden ver todos los pedidos de su tienda desde el dashboard.

## ¿Qué problemas resuelve?

- "El cliente confirmó la compra, ¿cómo se crea el pedido?" → checkout
- "¿Cuáles son los pedidos de esta tienda?" → listado para el admin
- "Quiero ver el detalle del pedido #123" → detalle de orden

## Funciones principales

- **checkout**: el paso más importante. Valida el carrito, reserva el stock de forma
  atómica (para evitar overselling), crea el pedido y registra cada ítem.
  Si algo falla, deshace todo automáticamente.
- **listOrders**: devuelve todos los pedidos de la org para el dashboard del admin.
- **getOrder**: devuelve el detalle de un pedido específico.
- **listCustomerOrders**: devuelve los pedidos de un cliente particular (para el historial del cliente).

## Estado del pago

El campo de pago (`paymentIntentId`) está preparado pero vacío por ahora —
se activará cuando se integre `pagos-back` (aún no existe).

## Estado actual

✅ Funcionando. El checkout usa transacciones atómicas. Pendiente: integración de pagos.
