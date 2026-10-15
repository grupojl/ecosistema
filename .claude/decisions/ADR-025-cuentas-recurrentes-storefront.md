# ADR-025: Cuentas recurrentes del storefront (verificación por email)

**Fecha:** 2026-10-14
**Estado:** Propuesto — no implementado
**Alcance:** realsass-ecommerce-back, real-ecommerce-front
**Complementa:** ADR-023 (modelo de seguridad)

## Contexto

Hoy el cliente del storefront es siempre un **invitado** (ADR-023): `customer.identify` crea un cliente nuevo y lo
ata a una cookie firmada. Si borra la cookie, cambia de navegador o de dispositivo, empieza de cero y pierde su
historial de pedidos. La regla del norte impide la salida fácil: **saber un email no puede ser una credencial**
(antes bastaba conocer un email para quedarse con la cuenta de otro).

## Por qué no se implementó

Necesita tres cosas que no están en el repo ni se pueden inventar:
1. **Un proveedor de email transaccional** (`resend` estaba en el catálogo pero sin uso, y se quitó). Hay que elegir
   proveedor, dominio de envío con SPF/DKIM y plantillas por idioma (ADR-016).
2. **Una decisión de producto**: qué ve el cliente, cuánto dura la sesión recurrente, qué pasa con el carrito del invitado.
3. **Una migración** de base de datos (tabla de desafíos) que debe revisarse con quien administra la base de Railway.

## Diseño propuesto

```
Flujo        identify(email) → se envía un código de 6 dígitos (o magic link) → verify(email, código) →
             el cliente pasa a isGuest=false y recibe la misma cookie firmada de siempre
Tabla        CustomerLoginChallenge { id, organizationId, emailHash, codeHash, expiresAt (10 min), attempts, usedAt }
             Se guarda el HASH del código y del email, nunca el valor
Fuerza bruta ≤ 5 intentos por desafío; rate limit por email+IP (el RateLimitStore ya existe) y por IP
Enumeración  La respuesta de "pedir código" es idéntica exista o no la cuenta; mismo tiempo de respuesta
Carrito      Al verificar, el carrito del invitado se fusiona con el de la cuenta (getOwnedCart sigue siendo la regla)
Cuenta ajena Verificar un email que ya tiene cuenta inicia SESIÓN en esa cuenta (no la "enlaza" desde otra)
Sesión       Sin cambios: cookie HttpOnly firmada (ADR-023). Solo cambia cómo se obtiene
```

## Criterios de aceptación (cuando se implemente)

- Con solo el email de otra persona no se obtiene su sesión (test de integración).
- Un código vence, se usa una vez y se bloquea tras 5 intentos (tests).
- No se distingue "email registrado" de "email nuevo" ni por respuesta ni por tiempo (test).
- El código nunca aparece en logs.
