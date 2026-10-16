# Contrato: sesiones y dispositivos del usuario

Decisión: ADR-020. Dueño del modelo: `realsass-sass-back`. Consumen: `realsass-dashboard-front` y
`realsass-sass-front`, ambos con el modal `DevicesDialog` de `@real/ui`. Estado: F1 y F2 ✅, F3 🔲.

## Modelo (Prisma, sass-back)

```prisma
model UserSession {
  id          String    @id @default(cuid())   // = sid de la cookie __sid
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceType  String                            // desktop | mobile | tablet | unknown
  browser     String?                           // "Chrome 130"
  os          String?                           // "Windows 11"
  ipPrefix    String?                           // IP truncada (/24 IPv4, /48 IPv6)
  country     String?                           // ISO-2, solo si el proxy lo informa
  createdAt   DateTime  @default(now())
  lastSeenAt  DateTime  @default(now())         // se actualiza al recrear la cookie (~55 min)
  expiresAt   DateTime                          // createdAt + 14 días (vida de __session)
  revokedAt   DateTime?

  @@index([userId, revokedAt])
  @@index([expiresAt])
}
```

Reglas: no se guarda la IP completa, la cookie ni el `User-Agent` crudo.

## Cookie `__sid`

HttpOnly · `sameSite: strict` · mismas opciones y `COOKIE_DOMAIN` que `__session`.
Se emite o renueva en `POST /auth/session` (ADR-004). Si llega un `__sid` válido del mismo
`uid` se actualiza `lastSeenAt`; si no, se crea una sesión nueva. `DELETE /auth/session`
revoca la sesión actual y borra ambas cookies.

## Router tRPC `sessions.*` (sass-back, `authProcedure`, sin organización)

| Procedure | Tipo | Fase | Qué hace |
|---|---|---|---|
| `sessions.list` | query | F1 ✅ | Sesiones activas del usuario (no revocadas ni vencidas), más reciente primero; cada una con `isCurrent` |
| `sessions.revoke` `{ sessionId }` | mutation | F2 ✅ | Revoca una sesión **propia**; ajena → `NOT_FOUND` (no revela existencia). Responde `wasCurrent`. La UI no ofrece cerrar la sesión actual (para eso está "Cerrar sesión") |
| `sessions.revokeOthers` | mutation | F2 ✅ | Revoca todas menos la actual |

Salida de `list` (shape inferido en los fronts desde `@real/trpc`, nunca escrito a mano):

```
{ id, deviceType, browser, os, ipPrefix, country, createdAt, lastSeenAt, isCurrent }
```

"Cerrar sesión en todos los dispositivos" sigue siendo `DELETE /auth/session` (revoca refresh
tokens de Firebase) y además marca todas las filas como revocadas.

## Validación en el middleware (F2)

`createTrpcAuthMiddleware` recibe la opción `isSessionRevoked(sid, uid)` (opcional: el ecommerce-back
no la usa). El sass-back la implementa con `SessionsService.isRevoked`: cache en memoria de 30 s
sobre lectura por PK, **sin query por request**. Revocado, o `sid` de otro usuario → no se inyecta
`req.user` → `UNAUTHORIZED`. Si la DB falla se acepta (la cookie de Firebase ya se verificó). Sin
`__sid` (cookie anterior) → se acepta hasta que venza. Revocar es inmediato en la instancia que lo
hace y tarda ≤30 s en las demás.

## Sesión en vivo entre fronts

Una sesión abierta o cerrada en un front se refleja en los demás sin recargar. La cookie `__session` es
la fuente de verdad (ADR-004); el usuario de Firebase vive por origen y no se comparte.

| Pieza | Dónde | Qué hace |
|---|---|---|
| `auth.ping` | sass-back, `authProcedure`, query | Responde `{ ok, uid }` si la cookie es válida y su `__sid` no está revocado. **Sin DB.** 401 si no |
| `pingSession(url)` | `@real/auth-client` | `open` / `closed` (401) / `unknown` (red o 5xx: no se asume nada) |
| `useSessionWatch(fn)` | `@real/auth-client` | Llama a `fn` al volver a la pestaña (`visibilitychange`, `focus`), al reconectar, cada 30 s con la pestaña visible, y al avisar otra pestaña del mismo origen (`BroadcastChannel`). Mínimo 2 s entre llamadas |
| `notifySessionChange()` | `@real/auth-client` | Se llama tras login/logout para avisar a las otras pestañas del origen |

Reglas de `revalidate` (en `AuthProvider` y en `sass-front/context/auth-context.tsx`):
- `closed` + hay sesión local → desloguea: limpia perfil y organización y hace `signOut` de Firebase.
- `open` + no hay sesión local → carga el perfil por cookie y entra solo.
- `unknown` → no hace nada: un corte de red nunca desloguea.
- Si hay un login/sync en curso no revalida (evita pisar el flujo de inicio de sesión).

Límite: los navegadores no avisan cambios de cookie entre orígenes (puertos/subdominios distintos), así que
entre fronts distintos el cambio se ve **al volver a esa pestaña** o en ≤30 s con la pestaña visible, no al
milisegundo. Tiempo real estricto exigiría SSE/WebSocket (no justificado hoy).

## Aviso de dispositivo nuevo (F3) — pendiente

Al crear una sesión cuyo (`browser`, `os`, `country`) no coincide con ninguna sesión previa
del usuario, se envía un mail. Fire-and-forget: si falla el mail, el login no falla.
