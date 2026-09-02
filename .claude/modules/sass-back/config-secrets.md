# Módulo: config-secrets (secretos y claves)

## ¿Qué hace en palabras simples?

Es la caja fuerte de claves privadas. Guarda tokens de APIs externas, claves
de pasarelas de pago, o cualquier dato sensible que la org necesite usar.
Los valores se guardan cifrados — ni el propio sistema los ve en texto plano.

## ¿Qué problemas resuelve?

- "Necesito guardar mi clave de Stripe de forma segura" → secret cifrado
- "Quiero rotar la clave sin interrumpir el servicio" → rotación segura
- "Ya no uso esta integración, quiero revocar la clave" → revocación

## Funciones principales

- **list**: muestra los nombres de las claves guardadas (nunca el valor real).
- **create**: guarda una nueva clave cifrada con su nombre descriptivo.
- **rotate**: reemplaza el valor de una clave existente con uno nuevo (sin eliminar el registro).
- **revoke**: desactiva una clave — queda en el historial pero no se puede usar.

## Seguridad

Los valores nunca se devuelven al front. Solo se guarda qué claves existen,
no qué dicen. El descifrado ocurre solo cuando el sistema lo necesita internamente.
Las acciones de rotación y revocación requieren reautenticación reciente (StepUp).

## Estado actual

✅ Funcionando. Cifrado implementado con CryptoService.
