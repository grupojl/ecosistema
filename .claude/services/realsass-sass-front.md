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

## Sesión compartida con el dashboard

`context/auth-context.tsx`: sin `firebaseUser` en este origen consulta `auth.me` por cookie; si responde, la
sesión queda abierta (`isAuthenticated`). `useSessionWatch` revalida con `auth.ping` (foco, 30 s, otras
pestañas) para reflejar logins/logouts hechos en otros fronts. Los componentes usan `isAuthenticated`, no `firebaseUser`.

## Arranque rápido de sesión

`context/auth-context.tsx` pide `auth.me` por cookie apenas monta (perfil + `sessionReady` en 1 request) y deja la
cadena de Firebase en segundo plano. `/profile` muestra skeleton mientras no hay datos (antes pintaba "Usuario").
`app/profile/page.tsx` prefetchea con la key real de tRPC: `[['auth','me'],{ type: 'query' }]`.

## Dispositivos (ADR-020) ✅

`/profile`: botón "Dispositivos" junto a "Cerrar sesión" abre el modal `DevicesDialog` de `@real/ui`
(`components/devices-dialog-connected.tsx`): lista, "Cerrar" por sesión y "Cerrar las demás".

## WhatsApp por organización (ADR-025, 2026-10-20) — implementado, sin probar con Meta

`/profile/config` incluye la sección "WhatsApp" (Embedded Signup de Meta): es **acá** donde se autoriza el WhatsApp de la organización,
no en el dashboard de colaboradores. Usa tRPC `whatsapp.*` de sass-back (solo OWNER, step-up). Nuevas variables `NEXT_PUBLIC_META_*`
(`.env.example` y Dockerfile, como Build Variables). Ver `contracts/whatsapp-channel.md` y `checklists/meta-whatsapp-app.md`.
