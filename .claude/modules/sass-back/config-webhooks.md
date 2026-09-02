# Módulo: config-webhooks (webhooks)

## ¿Qué hace en palabras simples?

Permite que el sistema avise automáticamente a otros programas cuando pasan
cosas importantes. Por ejemplo: "cuando se crea un pedido, mandá un aviso a
mi sistema de logística". Los webhooks son como alertas automáticas que el
sistema envía a donde el dueño indique.

## ¿Qué problemas resuelve?

- "Quiero que mi CRM se entere cuando llega un pedido" → webhook al CRM
- "¿Llegó el aviso? ¿Hubo algún error?" → historial de entregas
- "Quiero probar si el webhook está funcionando" → envío de prueba

## Funciones principales

- **list**: muestra todos los webhooks configurados de la org.
- **create**: configura un nuevo endpoint (URL) y qué eventos debe recibir.
- **remove**: elimina un webhook.
- **getLogs**: muestra el historial de envíos — si llegaron bien o fallaron.
- **test**: envía un evento de prueba para verificar que el endpoint funciona.

## ¿Quién lo usa?

- El panel del dueño (sass-front) — para configurar las notificaciones
- El sistema internamente — para enviar los avisos de forma automática (BullMQ)

## Estado actual

✅ Funcionando. Los envíos van a una cola BullMQ para garantizar la entrega.
