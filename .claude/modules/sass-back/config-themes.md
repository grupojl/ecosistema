# Módulo: config-themes (temas visuales)

## ¿Qué hace en palabras simples?

Es la identidad visual de la tienda. Permite al dueño personalizar los colores,
fuentes, logo y favicon de su tienda pública. El tema activo es lo que ven
los clientes cuando visitan la tienda.

## ¿Qué problemas resuelve?

- "Quiero que mi tienda tenga mis colores de marca" → configuración del tema
- "El logo cambió, necesito actualizarlo" → edición del tema activo
- "Quiero probar un diseño nuevo sin reemplazar el actual" → múltiples temas, uno activo

## Funciones principales

- **list**: muestra todos los temas de la org (pueden tener varios guardados).
- **getPublicTheme**: devuelve el tema activo de una org para mostrarlo en la tienda pública.
  Esta es la función que usa el storefront para saber cómo tiene que verse.
- **create**: crea un nuevo tema con colores, fuentes y logos.
- **activate**: activa un tema (desactiva el anterior automáticamente).
- **remove**: elimina un tema que no está activo.

## ¿Quién lo usa?

- El panel del dueño (sass-front) — para gestionar y editar temas
- La tienda pública (ecommerce-front) — para aplicar el tema activo visualmente

## Estado actual

✅ Funcionando. El tema activo se carga al inicio de cada visita al storefront.
