# Sección: Chat IA (/dashboard/chat)

## ¿Qué hace en palabras simples?

Es el asistente de inteligencia artificial integrado en el panel. El colaborador
puede hacerle preguntas, pedirle que genere descripciones de productos, que
analice ventas, o que ayude con cualquier tarea relacionada al negocio.

## Cómo funciona

El colaborador escribe un mensaje en el chat y el asistente responde en tiempo
real. Las conversaciones se guardan en proyectos para poder retomar el contexto
en otro momento.

## Conexión con el back

Se conecta con `chat-ia-back` vía fetch manual (`lib/chat-ia-client.ts`).
Esta es la única excepción documentada al principio tRPC-exclusivo del ecosistema —
`chat-ia-back` todavía no tiene router tRPC. Cuando lo tenga, este módulo
migrará igual que todos los demás.

## Estado actual

⚠️ Funcional pero con deuda técnica: fetch manual en lib/chat-ia-client.ts.
La página de prueba (/dashboard/chat/prueba) está aislada a propósito — es
código de testing, no de producción.
