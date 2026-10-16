# Módulo: customers (clientes de la tienda)

## ¿Qué hace en palabras simples?

Son los compradores de la tienda. Entran con Firebase (Google), igual que los dueños, pero son
clientes DE UNA organización: la misma cuenta es un cliente distinto en cada tienda. El back
deriva el cliente del token verificado (ADR-021); ya no hay `identify` ni header `x-customer-id`.

## ¿Qué problemas resuelve?

- "¿Quién es este comprador?" → identificación por email sin contraseña
- "Quiero ver el historial de compras de este cliente" → perfil del cliente
- "El cliente volvió a la tienda, ¿reconocemos que es el mismo?" → persistencia por customerId

## Funciones principales

- **Alta perezosa**: la primera vez que un usuario con email verificado usa una tienda se crea su
  `StoreCustomer` (único por organización + email). Ver `customers/resolve-customer.ts`.
- **getProfile**: devuelve los datos del cliente (nombre, email, dirección guardada).
- **listCustomerOrders**: devuelve el historial de pedidos del cliente.

## Diferencia con usuarios

Los "usuarios" (módulo users) son los dueños y colaboradores que se loguean
con Firebase. Los "clientes" (este módulo) son los compradores de la tienda: misma cuenta de Firebase, pero
un registro por organización.

## Estado actual

✅ Autenticación con Firebase (ADR-021). Sin verificar de punta a punta con un login real (ver deuda DT-STORE-UI-4).
