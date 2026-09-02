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
