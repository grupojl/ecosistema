# Módulo: inventory (stock e inventario)

## ¿Qué hace en palabras simples?

Sabe cuántas unidades hay disponibles de cada variante de producto. Cuando
alguien compra, descuenta el stock. Si hay una compra simultánea de la última
unidad por dos personas al mismo tiempo, el sistema garantiza que solo una
puede comprarla (sin overselling).

## ¿Qué problemas resuelve?

- "¿Cuántas unidades quedan del talle M en azul?" → stock disponible
- "Se vendió una unidad, descuentá el stock" → reserva atómica al checkout
- "Llegó mercadería, actualizá el stock" → carga de stock

## Funciones principales

- **setStock**: establece o actualiza la cantidad disponible de una variante.
- **reserveWithinTransaction**: reserva stock dentro de una transacción de base de datos.
  Esto garantiza que si dos personas compran al mismo tiempo, solo una lo logra.
  Es la pieza clave anti-overselling del checkout.

## Seguridad anti-overselling

La reserva usa una consulta especial con condición `WHERE stock > 0` ejecutada
atómicamente. Si el stock llega a 0 entre el momento en que el cliente ve el
producto y el momento en que confirma la compra, la reserva falla de forma segura.

## Estado actual

✅ Funcionando. La lógica anti-overselling está testeada con transacciones Prisma.
