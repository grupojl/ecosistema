# ADR-006: Cleanup definitivo del front — eliminar lib/api.ts y migrar a tRPC

**Fecha:** 2026-08-28
**Estado:** Implementado

## Contexto

ADR-005 cerró la migración REST→tRPC en el backend. El frontend todavía tiene
`lib/api.ts` como capa de fetch manual que varios archivos consumen directamente.
Con todos los procedures tRPC disponibles en `SassAppRouter`, `lib/api.ts` es
código muerto en camino a ser un vector de inconsistencia.

**Lo que `lib/api.ts` exporta hoy y su reemplazo:**

| Función en lib/api.ts | Reemplazado por |
|---|---|
| `syncUser(token, refCode?)` | `trpc.auth.sync.useMutation()` via `use-auth-trpc.ts` |
| `getMe(token)` | `trpc.auth.me.useQuery()` via `use-auth-trpc.ts` |
| `listCollaborators(token)` | `trpc.collaborators.list.useQuery()` |
| `inviteCollaborator(token, dto)` | `trpc.collaborators.invite.useMutation()` |
| `updateCollaboratorPermissions(token, id, dto)` | `trpc.collaborators.update.useMutation()` |
| `removeCollaborator(token, id)` | `trpc.collaborators.remove.useMutation()` |
| `acceptInvitation(token, inviteToken)` | `trpc.collaborators.acceptInvitation.useMutation()` |
| `getInvitationInfo(inviteToken)` | `trpc.collaborators.getInvitationInfo.useQuery()` (public procedure) |
| `selectRole(token, dto)` | `trpc.auth.selectRole.useMutation()` |
| `updateMyOrganization(token, dto)` | `trpc.organizations.update.useMutation()` |

**Excepción explícita — NO migrar a tRPC:**

| Fetch en código | Por qué queda en REST |
|---|---|
| `createSessionCookie(idToken)` en `auth-context.tsx` | Bootstrap del sistema de auth — setea cookie HttpOnly via `Set-Cookie` header. tRPC no puede setear cookies (retorna JSON). Si se migra, el browser nunca recibe la cookie. |
| `deleteSessionCookie()` en `auth-context.tsx` | Ídem — revoca la cookie HttpOnly en el back. Necesita `res.cookie('', '', { maxAge: 0 })`. |

Estos dos fetch son la única excepción permanente documentada en el ecosistema.
No son "legacy por falta de tiempo" — son la capa de bootstrap del sistema de
auth por diseño (ADR-004).

## Archivos a migrar

### sass-front

**1. `context/auth-context.tsx`**
- `syncUser(token, refCode)` → llamar `trpc.auth.sync` directamente (sin hook — es imperativo, no declarativo)
- `getMe(token)` → eliminado — el perfil viene de `trpc.auth.me` en los componentes
- El `syncAndLoad` del context pasa a ser: `syncUser` → `getIdToken(true)` → `createSessionCookie` → invalidar queryKey de `auth.me`

**2. `hooks/use-collaborators.ts`**
- Reescribir completamente usando `trpc.collaborators.*`
- Los 5 hooks pasan a ser wrappers tipados de los procedures tRPC

**3. `components/collaborators-section.tsx`**
- Reemplazar imports de `lib/api` por `use-collaborators.ts` migrado

**4. `app/profile/page.tsx`**
- `selectRole` → `useSelectRole()` de `use-auth-trpc.ts`
- `updateMyOrganization` → `trpc.organizations.update.useMutation()`
- `listCollaborators` / `inviteCollaborator` / etc. → hooks de `use-collaborators.ts`
- Migrar de useEffect/useState manual a TanStack Query

**5. `app/invite/[token]/page.tsx`**
- `getInvitationInfo(token)` → `trpc.collaborators.getInvitationInfo.useQuery({ token })`
  (requiere agregar `getInvitationInfo` como procedure @Public en el router)
- `acceptInvitation(token, firebaseUid)` → `trpc.collaborators.acceptInvitation.useMutation()`

### dashboard-front

**6. `app/auth/sso/page.tsx`**
- Inicializa Firebase directamente en el componente — bypass de `@real/auth-client`
- Migrar a `signInWithCustomToken` desde `@real/auth-client`

### Cleanup final (después de los 6 archivos)

Una vez migrados los 6 archivos:

- **Eliminar `lib/api.ts`** — no quedan callers
- **Eliminar `lib/types.ts`** — los tipos migran a los dominios o a `@real/trpc`
- **Eliminar `lib/firebase.ts`** en sass-front — reemplazado por `@real/auth-client`
  (hoy ya existe `@real/auth-client`, `lib/firebase.ts` es un wrapper redundante)
- **Eliminar `organizations/dto/update-organization.dto.ts`** — reemplazado por
  el schema Zod en `organizations.router.ts`
- **Eliminar `auth/dto/sync.dto.ts`** — reemplazado por el schema Zod en `auth.router.ts`

## Alternativas descartadas

- **Mantener lib/api.ts como capa de abstracción:** el argumento es que si el back
  cambia de tRPC a REST en el futuro, solo hay que cambiar `lib/api.ts`. Descartado
  porque ese cambio no va a pasar — ADR-005 establece tRPC como canal permanente.
  Mantener una capa de abstracción para un cambio que no va a ocurrir es deuda
  sin retorno.

- **Reescribir lib/api.ts para que internamente use tRPC:** introduce un cliente
  tRPC singleton fuera del contexto de React, que no puede usar hooks. Más complejo
  que migrar directamente los callers.

## Consecuencias

**Ganancia:**
- `lib/api.ts` eliminado — cero fetch manual en el front (excepto auth bootstrap)
- `lib/types.ts` eliminado — tipos viven en los dominios o se infieren desde `SassAppRouter`
- `lib/firebase.ts` eliminado — `@real/auth-client` es la única fuente de Firebase en los 3 fronts
- Type-safety completa end-to-end: si el back cambia un contrato, el front falla en build
- Los hooks de datos (use-collaborators, use-config, use-auth-trpc) son la única
  forma de obtener datos del servidor — sin excepciones no documentadas

**Costo:**
- `app/profile/page.tsx` es el archivo más complejo — tiene vistas múltiples
  (overview, add-role, edit-org, collaborators) con estado local mezclado con
  llamadas API. La migración requiere desglosar en componentes con hooks propios.

## Orden de ejecución

1. Agregar `getInvitationInfo` como publicProcedure en `collaborators.router.ts`
2. Migrar `hooks/use-collaborators.ts` a tRPC
3. Migrar `components/collaborators-section.tsx` (consume use-collaborators)
4. Migrar `app/invite/[token]/page.tsx`
5. Migrar `app/profile/page.tsx` (el más complejo — último)
6. Migrar `context/auth-context.tsx` — eliminar syncUser/getMe de lib/api
7. Migrar `dashboard-front/app/auth/sso/page.tsx` — usar @real/auth-client
8. Eliminar: `lib/api.ts`, `lib/types.ts`, `lib/firebase.ts` (sass-front),
   `auth/dto/sync.dto.ts`, `organizations/dto/update-organization.dto.ts`

## Referencias

- `realsass-sass-back/src/trpc/routers/collaborators.router.ts`
- `realsass-sass-back/src/trpc/routers/auth.router.ts`
- `realsass-sass-back/src/trpc/routers/organizations.router.ts`
- `realsass-sass-front/hooks/use-auth-trpc.ts` — hooks auth ya migrados
- `realsass-sass-front/hooks/use-config.ts` — modelo de hook tRPC correcto
- `decisions/ADR-004-auth-session-cookies.md` — por qué createSessionCookie queda en REST
- `decisions/ADR-005-rest-to-trpc.md` — migración back completada
