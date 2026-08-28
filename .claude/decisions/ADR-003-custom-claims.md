# ADR-003: Contrato de custom claims Firebase

**Fecha:** (referenciado en código, `claims.service.ts`)
**Estado:** Aceptado

## Contexto

Servicios de plataforma futuros (ej. `chat-ia-back`) necesitan validar
identidad y permisos de un usuario **sin llamar de vuelta a `sass-back`** por
cada request — eso agregaría latencia y acoplamiento sincrónico innecesario
para operaciones de alta frecuencia como chat.

## Decisión

`ClaimsService` (en `realsass-sass-back/src/auth/claims.service.ts`) emite
custom claims directamente en el token Firebase del usuario, con este shape:

```ts
interface PlatformClaims {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string; // 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' (mapeado desde OWNER/COLLABORATOR)
  permissions: {
    chat?: { canRead: boolean; canWrite: boolean };
  };
}
```

Los claims se emiten en `AuthService.syncUser()` (login/sync) y se pueden
reemitir vía `POST /auth/refresh-claims` cuando cambia la org activa.

## Consecuencias operativas importantes

- El frontend **debe** forzar `getIdToken(true)` después de login o de
  refresh-claims, o el token viejo (sin los claims nuevos) sigue siendo válido
  hasta el refresh natural (55 min) — documentado explícitamente en
  `auth-context.tsx`: *"Sin esto chat-ia-back rechaza con 403 hasta el
  refresh natural."*
- `mapRole()` traduce el rol interno (`OWNER`/`COLLABORATOR`) al rol de
  plataforma expuesto en claims (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`) — son dos
  vocabularios distintos a propósito, no debe asumirse 1:1 automático sin
  revisar `mapRole()`.
- Si emitir claims falla, **no debe romper el flujo de login** — el código
  lo maneja explícitamente con try/catch silencioso documentado.

## Alternativas descartadas

- Que cada servicio de plataforma llame a `sass-back` en cada request (como
  hace `ecommerce-back` con `OrganizationsClientService`) — descartado para
  chat específicamente por volumen de requests esperado; los claims evitan el
  round-trip.

## Consecuencias

- Ganancia: servicios de plataforma pueden validar sin red extra.
- Costo: los claims pueden quedar desactualizados hasta el próximo refresh —
  aceptable para `chat` (bajo impacto de un permiso viejo por unos minutos),
  a revisar caso por caso para futuros consumidores de claims.

## Referencias

`realsass-sass-back/src/auth/claims.service.ts`,
`realsass-sass-back/src/auth/auth.service.ts`,
`realsass-sass-front/context/auth-context.tsx`
