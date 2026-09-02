# Package: @real/trpc (el contrato entre back y front)

## ¿Qué hace en palabras simples?

Es el "acuerdo por escrito" entre los motores y las pantallas. Define exactamente
qué puede pedir cada pantalla a cada motor, qué datos tiene que enviar, y qué
datos va a recibir. Si alguien cambia algo en el motor sin actualizar el acuerdo,
el sistema avisa con un error antes de llegar a producción.

## ¿Qué problemas resuelve?

- "El front llamó a un endpoint que ya no existe" → error en tiempo de compilación, no en producción
- "Cambié el nombre de un campo en el back, ¿dónde se usa en el front?" → TypeScript lo marca automáticamente
- "¿Qué puede hacer cada pantalla?" → está escrito en el tipo SassAppRouter / EcommerceAppRouter

## ¿Por qué existe como package separado?

Porque tanto los motores como las pantallas necesitan saber cuál es el contrato.
Es el puente tipado que garantiza que si el back cambia, el front lo sabe.

## Contenido

- **SassAppRouter**: todos los procedimientos que expone sass-back (auth, organizaciones,
  colaboradores, configuración, etc.)
- **EcommerceAppRouter**: todos los procedimientos que expone ecommerce-back (catálogo,
  inventario, órdenes, carrito, cliente)

## Estado actual

✅ Completo. SassAppRouter + EcommerceAppRouter tipados. Sin casts `as any`.
