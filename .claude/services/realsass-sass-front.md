# realsass-sass-front

## Rol

Dashboard de dueños (OWNER). Landing pública + perfil + configuración de
organización + gestión de colaboradores.

## Le corresponde

- Landing (`saas-hero`, `pricing-section`, `features-section`, etc.)
- `/profile` — overview de organización propia + colaboraciones + afiliado
- `/profile/config` — flags, quotas, temas, plantillas, webhooks de la org activa
- `/invite/[token]` — aceptar invitación de colaborador
- `/settings/api-keys` — placeholder, pendiente de `ApiKeyModule`
- SSO hacia `dashboard-front` (`/auth/sso`, `useDashboardSSO`)

## Conecta con

- `realsass-sass-back` vía tRPC (`lib/trpc/client.ts`) — Bearer Firebase token
  + header `x-organization-id`
- `@real/auth-client` para Firebase (Google/Apple/Facebook sign-in)

## Estado de migración (gap conocido)

`app/profile/config/page.tsx` todavía usa fetch manual con `useState`/`useEffect`
(`lib/config-api.ts`), no TanStack Query — candidato a migración según
`architecture/02-frontend-capas.md` capa 2.

## UI — estado actual

Todos los componentes UI se importan desde `@real/ui`.
`components/ui/` fue eliminado — no existe más en este front.
`lib/utils.ts` re-exporta `cn` desde `@real/ui`.

## Auth — estado actual (ADR-004)

`context/auth-context.tsx` implementa el flujo completo de cookies HttpOnly:
- Login: syncUser → getIdToken(true) → POST /auth/session → cookie __session
- Refresh proactivo cada 55 min — renueva también la session cookie
- Logout: DELETE /auth/session (revoca server-side) → signOut Firebase
