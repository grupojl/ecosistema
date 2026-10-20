# Página: Configuración de organización (/profile/config)

## ¿Qué hace en palabras simples?

Es el panel de configuración avanzada de la organización. El dueño puede
ajustar el comportamiento y la apariencia de su tienda desde un solo lugar.

## Secciones

### Feature Flags
Interruptores para activar o desactivar funciones. Por ejemplo: "activar
el módulo de chat IA" o "habilitar pagos". El dueño los controla sin
necesidad de contactar al equipo técnico.

### Quotas (cuotas)
Muestra el consumo actual vs el límite de cada recurso: cuántos productos
cargados de los permitidos, cuántos colaboradores activos, etc.
Solo lectura — el límite lo define el plan.

### Temas visuales
Lista de diseños disponibles para la tienda. El dueño puede tener varios
guardados y activar uno. El tema activo es lo que ven los clientes.

### Webhooks
Configuración de notificaciones automáticas a sistemas externos. Por ejemplo:
"cuando llega un pedido, avisale a mi sistema de logística en esta URL".

## Estado actual

✅ Migrado a TanStack Query. Carga los datos desde los procedures tRPC de
config-flags, config-quotas, config-themes y config-webhooks.

### WhatsApp (ADR-025) — implementado, sin probar con Meta
Sección al final de `/profile/config` (`components/config/whatsapp-section.tsx`, lógica en `features/whatsapp/`). El dueño autoriza
el WhatsApp de su negocio con Embedded Signup de Meta (SDK de Facebook), ve el número y el estado, y puede desconectar. Habla con
sass-back por tRPC (`whatsapp.status/connect/disconnect`, tipos inferidos de `@real/trpc`); conectar y desconectar piden step-up.
Al back solo viaja el `code` y los ids de la cuenta; tokens y App Secret nunca llegan al navegador. Variables públicas:
`NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID`, `NEXT_PUBLIC_META_GRAPH_VERSION`. Typecheck en verde. Contrato: `contracts/whatsapp-channel.md`.
