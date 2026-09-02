# Sección: Tienda (/dashboard/tienda)

## ¿Qué hace en palabras simples?

Es el corazón del trabajo diario. Desde acá el colaborador gestiona todo
lo de la tienda: carga productos, actualiza stock, revisa los pedidos que
llegaron y puede previsualizar cómo se ve la tienda para los clientes.

## Subsecciones

### Productos (/dashboard/tienda/productos)
Lista completa del catálogo. Se pueden crear productos nuevos con sus variantes
(talle, color, precio), editarlos, publicarlos o archivarlos.

### Pedidos (/dashboard/tienda/pedidos)
Lista de todas las órdenes recibidas. Muestra el estado de cada pedido,
los datos del cliente y los productos comprados. El colaborador puede
ver el detalle de cada pedido.

### Preview (/dashboard/tienda/preview)
Vista previa de la tienda tal como la ven los clientes. Permite verificar
que los cambios de productos y temas se ven bien antes de que los clientes
los vean.

## Permisos

El dueño puede configurar qué puede hacer cada colaborador:
- ¿Puede ver el listado de productos? ¿Y crearlos? ¿Editarlos? ¿Borrarlos?
- ¿Puede ver las estadísticas?
- ¿Puede ver los pedidos?

Si un colaborador no tiene el permiso, la sección no aparece o aparece
bloqueada.

## Estado actual

✅ Funcional. Usa features/catalog/hooks y features/orders/hooks con TanStack Query.
