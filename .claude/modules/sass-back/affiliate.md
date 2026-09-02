# Módulo: affiliate (programa de afiliados)

## ¿Qué hace en palabras simples?

Es el programa de referidos. Cada usuario tiene un código único que puede
compartir. Cuando alguien nuevo se registra usando ese código, el afiliado
acumula referidos en su cuenta. Es la base para un futuro sistema de
comisiones o beneficios.

## ¿Qué problemas resuelve?

- "¿Cuántas personas se registraron con mi código?" → contador de referidos
- "¿Quiénes son los usuarios que recomendé?" → lista de referidos
- "Alguien se registró con mi código" → incrementa el contador automáticamente

## Funciones principales

- **getMyProfile**: muestra el perfil de afiliado — código propio, balance y cantidad de referidos.
- **getMyReferrals**: lista de usuarios que se registraron usando el código del afiliado.
- **registerReferral**: cuando un nuevo usuario se registra con un código, este módulo
  lo registra automáticamente en segundo plano.

## ¿Quién lo usa?

- El panel del dueño (sass-front) — para ver el panel de afiliado
- El módulo de auth — para registrar referidos al momento del login

## Estado actual

✅ Funcionando. El balance está preparado para cuando se implemente el sistema de pagos.
