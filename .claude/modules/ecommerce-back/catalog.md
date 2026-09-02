# Módulo: catalog (catálogo de productos)

## ¿Qué hace en palabras simples?

Es la vidriera de la tienda. Guarda todos los productos con sus descripciones,
fotos, precios y variantes (talle, color, etc.). El dueño y sus colaboradores
pueden agregar, editar y organizar productos desde el dashboard. Los clientes
ven el catálogo en la tienda pública.

## ¿Qué problemas resuelve?

- "Quiero agregar un producto nuevo con 3 variantes de talle" → creación de producto
- "El precio del producto A cambió" → actualización
- "¿Qué productos tiene esta tienda?" → listado para el storefront y el admin

## Funciones principales

- **listProductsAdmin**: lista todos los productos de la org (borradores + publicados + archivados).
- **createProduct**: crea un producto con sus variantes.
- **updateProduct**: edita los datos de un producto existente.
- **listProductsPublic**: lista los productos publicados para el storefront (sin borradores).
- **getProductPublic**: devuelve el detalle de un producto para mostrarlo en la tienda.

## ¿Quién lo usa?

- El dashboard de colaboradores — para gestionar el catálogo
- La tienda pública (ecommerce-front) — para mostrar los productos a los clientes

## Estado actual

✅ Es el módulo más completo — tiene Domain + Repository implementados (es el molde de referencia).
