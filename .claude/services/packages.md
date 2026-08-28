# packages/* — librerías compartidas

Recordatorio: estos NO son servicios corriendo aparte. Se copian y buildean
dentro de cada imagen Docker que los consume (`workspace:*` resuelto en build
time). Ver `architecture/00-principios.md`.

## @real/auth-client

Consumido por los 3 fronts. Única fuente de:
- `apiFetch<T>` — fetch autenticado con retry en 401 (force-refresh de token
  y reintento único), lanza `AppError` tipado
- Firebase client wrapper: `initFirebase`, `getFirebaseAuth`, `getIdToken`,
  `signInWithGoogle`, `signOut`
- `AppError` con `AppErrorCode`: AUTH, FORBIDDEN, NOT_FOUND, VALIDATION,
  CONFLICT, RATE_LIMIT, SERVER, NETWORK
- `setActiveOrganizationId`/`getActiveOrganizationId` — en memoria, NO localStorage

## @real/auth-server

Consumido por los 2 backs NestJS. Única fuente de:
- `FirebaseModule` (`@Global()`, inicializa Admin SDK una vez)
- `FirebaseAuthGuard` — guard global, respeta `@Public()`
- `TenantGuard` — resuelve `TenantContext`, requiere `CachePort` inyectado
- `RolesGuard` — RBAC jerárquico
- `CachePort` + `MemoryCacheAdapter`
- `createTrpcAuthMiddleware` — factory que unifica `firebaseAuth` +
  `tenantContext` como middleware Express para el adapter tRPC
- `SessionService` — crea/verifica/revoca Firebase Session Cookies (ADR-004)
- `AuthSessionController` — POST /auth/session + DELETE /auth/session (ADR-004)
- Decorators: `@CurrentUser()`, `@Public()`, `@Roles()`, `@Tenant()`

## @real/ui

✅ Completo — 33 componentes shadcn instalados (pnpm dlx shadcn@4.18.0).

Consumido por los 3 fronts. Fuente única de todos los componentes UI.
Los fronts importan directo: `import { Button } from '@real/ui'`

**Las carpetas `components/ui/` fueron eliminadas de los 3 fronts.**
**`lib/utils.ts` en los 3 fronts re-exporta `cn` desde `@real/ui`.**

Componentes disponibles (33):
accordion, alert, alert-dialog, avatar, badge, button, card, checkbox,
collapsible, dialog, drawer, dropdown-menu, hover-card, input, label,
navigation-menu, popover, progress, radio-group, scroll-area, select,
separator, sheet, skeleton, slider, sonner, switch, table, tabs, textarea,
toggle, toggle-group, tooltip

Para agregar un componente nuevo:
  pnpm dlx shadcn@4.18.0 add --cwd packages/ui <nombre>
  Luego agregar `export * from './components/<nombre>'` en `src/index.ts`

## @real/trpc

Contratos tRPC compartidos. Exporta:
- `SassAppRouter` — tipo del router de `realsass-sass-back`
- `EcommerceAppRouter` — tipo del router de `realsass-ecommerce-back`
- Context compartido (`server/context.ts`, `server/trpc.ts`)

Los fronts importan: `import type { SassAppRouter } from '@real/trpc'`
