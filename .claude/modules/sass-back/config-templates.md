# Módulo: config-templates (plantillas de texto)

## ¿Qué hace en palabras simples?

Son textos reutilizables con espacios en blanco que el sistema puede rellenar
automáticamente. Por ejemplo: el mensaje de confirmación de pedido, el email
de bienvenida, el SMS de seguimiento. En lugar de escribir el mismo texto cada
vez, se crea una plantilla una vez y el sistema la usa cuando la necesita.

## ¿Qué problemas resuelve?

- "Quiero personalizar el mensaje de confirmación de pedido" → plantilla editable
- "Necesito usar la misma plantilla en distintos flujos" → se llama por nombre (key)
- "El mensaje dice {{nombre_cliente}}, ¿cómo se rellena?" → renderizado con variables

## Funciones principales

- **list**: muestra todas las plantillas de la org.
- **resolve**: busca una plantilla por su nombre clave (ej: `order_confirmation`).
- **renderByKey**: busca la plantilla y la rellena con las variables que se le pasan.
  Ejemplo: `{{nombre}}` → `"Juan"`, `{{total}}` → `"$1.500"`.
- **create**: crea una nueva plantilla con su nombre clave y contenido.

## Ejemplo de uso

```
Plantilla "bienvenida":
  "Hola {{nombre}}, bienvenido a {{tienda}}. Tu código de descuento es {{codigo}}."

Renderizada con: { nombre: "Ana", tienda: "Mi Tienda", codigo: "NUEVO10" }
  → "Hola Ana, bienvenida a Mi Tienda. Tu código de descuento es NUEVO10."
```

## Estado actual

✅ Funcionando. Sintaxis `{{variable}}` para interpolación de texto.
