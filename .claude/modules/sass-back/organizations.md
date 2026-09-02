# Módulo: organizations (organizaciones)

## ¿Qué hace en palabras simples?

Es la "empresa" dentro del sistema. Cada dueño tiene una organización que
agrupa todo lo de su negocio: su tienda, su equipo, su configuración.
Este módulo guarda los datos básicos de esa empresa y permite consultarla
o actualizarla.

## ¿Qué problemas resuelve?

- "¿Cuál es la org de este dueño?" → busca por usuario autenticado
- "¿Qué org corresponde a este slug de tienda?" → resuelve slug → org para el storefront
- "Quiero cambiar el nombre/logo de mi empresa" → actualiza los datos

## Funciones principales

- **getMyOrganization**: devuelve los datos de la org del dueño autenticado.
- **updateMyOrganization**: permite editar nombre, descripción, logo, website.
- **findBySlugPublic**: dado un slug (ej: `mi-tienda`), devuelve los datos públicos
  de la organización. Es lo que usa ecommerce-back para saber a qué org pertenece una tienda.

## ¿Quién lo usa?

- El panel del dueño (sass-front) — para ver y editar los datos de su empresa
- El motor de ecommerce (ecommerce-back) — para resolver a qué org pertenece una tienda

## Estado actual

✅ Funcionando. El slug de la tienda y enabledProducts están en el schema.
