# Módulo: store (información de la tienda)

## ¿Qué hace en palabras simples?

Resuelve el "¿de quién es esta tienda?". Cuando alguien visita `misitienda.com/tienda/mi-marca`,
este módulo traduce el slug `mi-marca` a la organización correcta y verifica
que la tienda esté activa. Es el primer paso al entrar a cualquier tienda.

## ¿Qué problemas resuelve?

- "¿A qué organización pertenece la tienda con slug 'zapatillas-runner'?" → resolución de slug
- "¿Esta tienda tiene el ecommerce activado?" → verificación de estado
- "La tienda no existe o está desactivada" → devuelve 404

## Funciones principales

- **resolveBySlug**: dado un slug (el nombre en la URL), consulta a sass-back para
  obtener el `organizationId` y verificar que la tienda está activa.
  Este resultado se puede cachear porque el slug no cambia frecuentemente.

## Nota importante

Este módulo no tiene su propia tabla de organizaciones. Consulta a `sass-back`
(que sí es el dueño de los datos de organizaciones) vía HTTP + Redis cache.

## Estado actual

⚠️ Funciona via REST. Pendiente migrar a `customer.resolveStore` procedure tRPC.
