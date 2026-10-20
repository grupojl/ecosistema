# Sección: Chat IA (/chat)

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

## WhatsApp (ADR-025)

La conexión del WhatsApp de la organización **no se hace acá**: por ahora se autoriza en el panel del dueño (`realsass-sass-front`, `/profile/config`). Este dashboard no tiene esa pantalla. Ver `decisions/ADR-025-whatsapp-embedded-signup-sass-front.md`.

## Estado actual

⚠️ Funcional pero con deuda técnica: fetch manual en lib/chat-ia-client.ts.
La página de prueba (/chat/prueba) está aislada a propósito — es
código de testing, no de producción.
