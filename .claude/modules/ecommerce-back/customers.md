# Módulo: customers (clientes de la tienda)

## ¿Qué hace en palabras simples?

Son los compradores de la tienda. A diferencia de los dueños y colaboradores
(que usan Google/Apple para entrar), los clientes se identifican solo con su
email. El sistema les asigna un ID de cliente que viaja en silencio con cada
acción (ver catálogo, agregar al carrito, comprar).

## ¿Qué problemas resuelve?

- "¿Quién es este comprador?" → identificación por email sin contraseña
- "Quiero ver el historial de compras de este cliente" → perfil del cliente
- "El cliente volvió a la tienda, ¿reconocemos que es el mismo?" → persistencia por customerId

## Funciones principales

- **identify**: cuando el cliente ingresa su email, el sistema lo busca o lo crea
  y devuelve su `customerId`. Este ID se guarda en el navegador para futuras visitas.
- **getProfile**: devuelve los datos del cliente (nombre, email, dirección guardada).
- **listCustomerOrders**: devuelve el historial de pedidos del cliente.

## Diferencia con usuarios

Los "usuarios" (módulo users) son los dueños y colaboradores que se loguean
con Firebase. Los "clientes" (este módulo) son los compradores de la tienda
que no necesitan cuenta ni contraseña — solo su email.

## Estado actual

✅ Funcionando. Sin Firebase — los clientes se autentican solo con su customerId.
