# Módulo: config-quotas (cuotas y límites)

## ¿Qué hace en palabras simples?

Define los límites de uso de cada organización. Por ejemplo: "esta org puede
tener hasta 100 productos", "este plan permite hasta 5 colaboradores", "este
mes ya usó 80 de sus 100 API calls". Cuando se alcanza el límite, el sistema
lo comunica en lugar de dejar continuar.

## ¿Qué problemas resuelve?

- "¿Cuánto ha usado esta org de su límite?" → muestra el consumo actual
- "Esta org quiere agregar un producto más pero ya llegó al límite" → bloquea y avisa
- "Subí el plan de este cliente, necesito aumentarle el límite" → actualiza el límite

## Funciones principales

- **getForOrg**: devuelve todos los límites configurados y cuánto se ha usado de cada uno.
- **check**: verifica si una acción está dentro del límite. Si no, lanza un error claro.
- **increment**: suma al contador de uso cuando se realiza una acción (ej: crear un producto).
- **updateLimit**: cambia el límite máximo de un recurso para una org.

## ¿Quién lo usa?

- El panel del dueño y colaboradores — para ver el uso actual
- Los módulos de catálogo, colaboradores, etc. — para verificar antes de crear algo nuevo

## Estado actual

✅ Funcionando. Preparado para integrar con planes de suscripción.
