# ADR-023: Modelo de seguridad — lo que el cliente fabrica no es una credencial

**Fecha:** 2026-10-14
**Estado:** Aceptado
**Alcance:** realsass-sass-back, realsass-ecommerce-back, `@real/auth-server` y los 4 fronts
**Complementa:** ADR-004 (cookies HttpOnly), ADR-013 (API key de servicio), ADR-018, ADR-022

## El norte

> **Nada que el cliente pueda fabricar es una credencial · todo falla cerrado · todo secreto es rotable.**

## Contexto

La auditoría del 2026-10-14 encontró que el storefront confiaba en datos que arma el propio cliente:

- `customerProcedure` tomaba el cliente del header `x-customer-id`, **sin firma**: quien conociera un
  `customerId` operaba esa cuenta (órdenes, carrito, checkout).
- `identifyBySession` devolvía **cualquier invitado de la organización**: todos los visitantes compartían
  el mismo cliente. Además el router le pasaba los argumentos en otro orden (el email llegaba como `sessionId`).
- Los carritos se identificaban por un `sessionId` que elige el cliente y `cart.get` / `removeItem` /
  `checkout` no verificaban de quién era el carrito.
- ecommerce-back, sin `ALLOWED_ORIGINS`, **reflejaba cualquier `Origin` con credenciales**.
- Las API keys internas se comparaban con `!==` y se enviaban como `''` si faltaba la variable.
- `/trpc` es middleware de Express: el `ThrottlerGuard` de Nest **no lo cubría**. Sin rate limit.
- `TenantGuard` llamaba a sass-back sin timeout (un sass-back lento colgaba todas las rutas con tenant).

## Modelo de amenazas

| Actor | Qué intenta | Qué lo impide |
|---|---|---|
| Visitante anónimo | Operar la cuenta de otro cliente sabiendo su `customerId` o su email | El `customerId` sale solo de la cookie firmada (HMAC); `identify` nunca devuelve una cuenta existente |
| Visitante anónimo | Ver / pagar el carrito de otro | `getOwnedCart`: el `sessionId` del carrito es el `customerId` de la sesión; mismo `NOT_FOUND` si no existe o es ajeno |
| Cliente de la tienda A | Usar su sesión en la tienda B | `enforceCustomer` exige `customerOrganizationId === organizationId` |
| Script de XSS | Robar la sesión del cliente | Cookie `HttpOnly` + `SameSite=Strict`: el JavaScript nunca ve el token (ADR-004) |
| Sitio de un tercero | Pedir datos con las cookies de la víctima | CORS con lista explícita (`ALLOWED_ORIGINS`, sin `*` ni `origin: true`) + `SameSite=Strict` |
| Atacante de red | Adivinar una API key midiendo tiempos | `matchesAnyKey` compara hashes con `timingSafeEqual` |
| Atacante con una clave filtrada | Seguir usándola indefinidamente | Claves rotables `nueva,vieja`; el emisor usa la primera y el receptor acepta todas |
| Bot | Inundar `identify` (crea filas) o `checkout` (reserva stock) | Rate limit en `/trpc`: 10/min por IP en `identify` y `checkout`, 300/min en el resto |
| Cualquier cliente | Agotar los backs con un sass-back lento | Timeout 3 s + circuit breaker en `TenantGuard` y en `OrganizationsClientService` |
| Cualquiera | Leer detalles internos en un error 500 | En producción `INTERNAL_SERVER_ERROR` y los 5xx no exponen su mensaje |
| Receptor de un webhook | Aceptar un replay | `X-Webhook-Timestamp` (también firmado dentro del body): descartar si supera 5 minutos |

## Reglas no negociables

```
Identidad   customerId solo de la cookie HttpOnly store_session (HMAC-SHA256, 30 días, atada a la org).
            Prohibido leerlo de un header. identify nunca busca por email
Carrito     sessionId del carrito == customerId de la sesión. Todo acceso pasa por getOwnedCart
Arranque    Sin ALLOWED_ORIGINS, INTERNAL_API_KEY o CUSTOMER_SESSION_SECRET el servicio NO levanta
CORS        Lista explícita. "*" y origin:true prohibidos
Claves      identifyCaller/matchesAnyKey (tiempo constante) para recibir, firstKey para enviar; nunca ''.
            INTERNAL_API_KEY admite "nueva,vieja" (rotación) o UNA POR SERVICIO "ecommerce=<k>,superadmin=<k>"
            (se audita quién llama y se revoca de a uno). CUSTOMER_SESSION_SECRET admite "nuevo,viejo"
Tienda      customer.identify solo para tiendas que existen y están abiertas (assertStorefrontOpen)
Proxy       trust proxy configurado (TRUST_PROXY; default 1 en producción) para que el rate limit vea la IP real
Rate limit  /trpc de ambos backs: por IP antes de autenticar y por usuario después, con el contador en Redis
            (compartido entre réplicas; sin Redis cae a memoria por instancia)
Servicios   Toda llamada entre servicios con timeout; las críticas con circuit breaker
Errores     Sin mensajes internos en producción
Fronts      Sin tokens en localStorage (C3). X-Frame-Options, nosniff, Referrer-Policy y HSTS en los 4
Commits     pre-commit (.githooks) frena secretos y archivos basura; gitleaks revisa el historial en el CI
```

Cada regla tiene un chequeo automático en `scripts/audit/seguridad.sh` (S1–S7). S7 exige que existan los tests
que fijan los invariantes, y esos tests corren en el CI (`ci.yml`, job `tests`): sesión firmada (alteración,
vencimiento, rotación, cookie), aislamiento de carritos, tienda cruzada, claves por servicio, rate limit (memoria y
Redis), circuit breaker, guards (`TenantGuard`, `RolesGuard`, `FirebaseAuthGuard`), anti-SSRF, firma de webhooks y
montaje real de `TrpcModule` con el prefijo de producción. Se verificó que fallan si se rompe la regla (mutaciones).

## Rotar un secreto sin caída

```
CUSTOMER_SESSION_SECRET   1) desplegar ecommerce-back con "nuevo,viejo"   (firma con nuevo, acepta ambos)
                          2) esperar 30 días (o aceptar que las sesiones viejas se renueven)
                          3) desplegar con "nuevo"
INTERNAL_API_KEY          1) sass-back: "nueva,vieja"   2) ecommerce-back: "nueva"   3) sass-back: "nueva"
```

## Deuda consciente / riesgo residual

- **Sin Redis el rate limit vuelve a ser por instancia**: con `REDIS_ENABLED=false` (o Redis caído) el contador
  cae a memoria. Con más de una réplica y sin Redis el límite efectivo se multiplica por N.
- **Sin cuentas recurrentes**: el cliente es siempre un invitado. Si borra la cookie o cambia de dispositivo
  empieza uno nuevo y pierde su historial. Recuperarlo exige verificar el email (OTP / magic link): no se
  implementó a propósito, porque "saber un email" no puede ser una credencial. Diseño en ADR-025.
- **El envío lo calcula el cliente**: `customer.checkout` acepta `shippingCents` del body. El precio de los
  ítems sale de la base, pero el costo de envío debería calcularse en el servidor desde el `fulfillmentConfig`
  del Market (ya guardado como snapshot en la orden). Hoy un cliente puede mandar `shippingCents: 0`.
- **`getInvitationInfo` devuelve la invitación completa** (colaborador y organización) a un endpoint público: debería
  devolver solo lo que la pantalla de aceptación necesita (nombre de la tienda, email invitado, vencimiento).
- **Dominios propios de tiendas**: la cookie es `SameSite=Strict`, así que el storefront tiene que ser
  *same-site* con la API (`COOKIE_DOMAIN`). Un storefront en otro dominio raíz requiere otro mecanismo
  (proxy BFF del lado del front) y agregar su origen a `ALLOWED_ORIGINS`.
- **CSP de los fronts**: `real-ecommerce-front` y `dashboard-front` llevan solo el subconjunto que no
  restringe scripts (`frame-ancestors`, `base-uri`, `object-src`, `form-action`); `sass-front` y `docs-front`
  ya tenían CSP completa pero con `'unsafe-inline'`. Una CSP con nonces cambia cómo se renderiza cada página y
  necesita validarse en un navegador: diseño en ADR-026.
- **Claves de servicio, no JWT**: la clave por servicio permite auditar y revocar de a uno, pero sigue siendo un
  secreto compartido estático. Un JWT firmado entre servicios (con `aud` y expiración corta) sería el paso siguiente.
- **Carritos en curso al desplegar**: los carritos viejos (con `sessionId` elegido por el cliente) quedan
  huérfanos; los clientes arrancan un carrito nuevo.

## Despliegue — variables obligatorias

| Servicio | Variable | Nota |
|---|---|---|
| ecommerce-back | `CUSTOMER_SESSION_SECRET` | nueva, ≥ 32 caracteres (`openssl rand -hex 32`) |
| ecommerce-back | `ALLOWED_ORIGINS` | antes era opcional; ahora sin ella no arranca |
| ambos | `INTERNAL_API_KEY` | ≥ 32 caracteres en producción |
| ambos | `TRUST_PROXY` | opcional (default 1 en producción) |
| ambos | `COOKIE_DOMAIN` | dominio raíz compartido con el storefront (ya usado por `__session`) |
