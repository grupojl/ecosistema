# ADR-020: Sesiones y dispositivos del usuario (modelo GitHub)

**Fecha:** 2026-10-16
**Estado:** Aceptado — F1 y F2 implementadas (2026-10-16); F3 pendiente
**Alcance:** `realsass-sass-back` (dueño del modelo) · `@real/auth-server` · fronts autenticados
**Complementa:** ADR-004 (session cookies HttpOnly) · `domain/flows/owner-organizacion.md` §Paso 1 (D5)
**Contrato:** `contracts/user-sessions.md` · **Módulo:** `modules/sass-back/user-sessions.md`

## Contexto

La política de sesión (D5) prevé "lista de dispositivos/sesiones activas" y hoy solo existe
"cerrar sesión en todos los dispositivos" (`revokeRefreshTokens`). No se guarda nada por
sesión: no hay modelo, endpoint ni pantalla. Firebase solo revoca **por usuario**, no por
sesión, así que cerrar un dispositivo puntual necesita estado propio.

**Norte:** GitHub *Settings → Sessions* (lista simple, revocar por sesión, aviso por mail de
acceso nuevo) y Google *Tus dispositivos* (marca el dispositivo actual).
*El usuario ve qué sesión es, de dónde y cuándo; puede cerrar una puntual o todas las demás.*

## Decisión

1. Modelo `UserSession` en sass-back; **una fila por login de navegador**, no por request.
2. El `sid` viaja en una cookie HttpOnly propia `__sid` (mismas opciones y `COOKIE_DOMAIN` que
   `__session`). Se crea o renueva en `POST /auth/session` (la misma excepción técnica de
   ADR-004; **no se agrega ningún endpoint REST nuevo**).
3. Todo lo demás es tRPC: namespace `sessions.*` con `authProcedure` (sin organización).
4. **Sin consulta a DB por request.** El middleware consulta `isSessionRevoked(sid, uid)`, que lee
   un cache en memoria de 30 s sobre una lectura por PK. Revocar actualiza el cache de la instancia
   al instante; las demás réplicas lo ven en ≤30 s.
5. La UI es un **modal** (`DevicesDialog` en `@real/ui`), abierto desde un botón "Dispositivos" en
   `realsass-dashboard-front` (menú de usuario del sidebar) y en `realsass-sass-front` (`/profile`).
6. Se guarda lo mínimo: dispositivo/navegador/SO derivados del `User-Agent`, IP truncada
   (/24 IPv4, /48 IPv6) y país si el proxy lo informa. **Nunca** la IP completa ni la cookie.
7. Adopción por fases (cada una se puede liberar sola):

| Fase | Entrega | Revocación |
|---|---|---|
| **F1** ✅ | Registro de sesiones + `sessions.list` + modal (marca "este dispositivo") | la existente: cerrar todas |
| **F2** ✅ | `sessions.revoke` / `sessions.revokeOthers` + chequeo de `sid` en el middleware | por sesión |
| **F3** 🔲 | Aviso por mail de dispositivo nuevo | — |

## Alternativas descartadas

- **Guardar el hash de la session cookie de Firebase como id** — la cookie se recrea cada
  55 min, cada recreación parecería un dispositivo nuevo.
- **Consultar `UserSession` en cada request** — una query a DB por request. El cache de 30 s la
  reduce a una por sesión cada 30 s.
- **Revocados en Redis (`CachePort`)** — Redis deshabilitado en dev y una purga de Redis "resucitaría"
  sesiones revocadas. La DB es la fuente de verdad; el cache es solo una optimización.
- **Usar `refreshToken`/`tokensValidAfterTime` de Firebase por dispositivo** — Firebase no lo
  soporta; solo revoca todo el usuario.
- **Geolocalización por IP con servicio externo** — dato personal enviado a un tercero y
  dependencia nueva (R4 de ADR-018). Se usa solo el header del proxy si existe.
- **Mail en F1** — requiere proveedor de mail; `resend` estaba en el catalog sin consumidor.
  Entra en F3 con el checklist R4 y dueño asignado.

## Consecuencias

**Se gana:** el usuario detecta y corta un acceso ajeno sin cerrar el resto; confianza para
vender a otras organizaciones.

**Se sacrifica / límites conocidos:**
- `lastSeenAt` se actualiza en cada recreación de cookie (~55 min), no por request: la
  granularidad es de ~1 h. Es deliberado (sin escrituras por request).
- Cookies emitidas **antes** de F2 no tienen `sid`: siguen válidas hasta vencer (14 días) y no
  aparecen en la lista; "cerrar todas" sí las corta.
- La revocación tarda hasta 30 s en llegar a otras réplicas del sass-back.
- **`realsass-ecommerce-back` no chequea `__sid`**: una sesión cerrada sigue siendo válida contra
  ese back hasta que venza la cookie de Firebase (≤14 días) o se use "cerrar en todos"
  (DT-SES-05).

**Deuda consciente:** F3 (mail) y chequeo de `__sid` en el ecommerce-back (DT-SES-04/05).
La limpieza de vencidas corre dentro del sass-back cada 24 h (`setInterval`), sin job externo.

## Referencias

- `packages/auth-server/src/session/session.service.ts` · `auth-session.controller.ts`
- `packages/auth-server/src/ports/cache.port.ts`
- `packages/auth-server/src/middleware/create-trpc-auth-middleware.ts`
- `packages/auth-client/src/react/auth-provider.tsx` (recreación de cookie a los 55 min)
