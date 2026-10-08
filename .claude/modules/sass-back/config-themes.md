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

- **list** (tRPC): muestra todos los temas de la org (pueden tener varios guardados).
- **create** (tRPC, solo OWNER): crea un nuevo tema con colores, fuentes y logos.
- **activate** (tRPC): activa un tema (desactiva el anterior automáticamente).
- **remove** (tRPC, solo OWNER): elimina un tema que no está activo ni es default del sistema.
- **getPublicTheme** (solo service/repo): devuelve el tema activo para el storefront. **No está expuesto
  en el router tRPC** (ver estado actual).

## ¿Quién lo usa?

- El panel del dueño (sass-front) — para gestionar y editar temas
- La tienda pública (ecommerce-front) — para aplicar el tema activo visualmente

## Estado actual (2026-10-08)

✅ El router tRPC expone `list`, `create`, `activate`, `remove` (antes `list` devolvía un único tema y
`update` solo llamaba a `activate`; se alineó con lo que implementa el service). Ya no hay `update`.
⚠️ `realsass-sass-front/lib/config-client.ts` llama `configThemes.getPublicTheme`, que no existe en el
router: falta decidir si se expone como procedure público o si el storefront lo obtiene por otra vía.
