# Backend Capa 1 — Auth/Tenant resolution
# Checklist 10/10

**Score actual: 8.5/10 — nivel Shopify plataforma**
**Score objetivo: 10/10 — nivel Stripe/Cloudflare**

## ✅ Completado

- [x] `createTrpcAuthMiddleware` centralizado en `@real/auth-server`
- [x] Cookies HttpOnly `__session` — ADR-004 implementado
- [x] `POST /auth/session` + `DELETE /auth/session` con `cookieParser`
- [x] `FirebaseAuthGuard` + `TenantGuard` + `RolesGuard` como `APP_GUARD` global
- [x] Custom claims Firebase (ADR-003) — refresh proactivo 55 min
- [x] `SessionService` — revocación server-side real via `revokeRefreshTokens`
- [x] CORS con `ALLOWED_ORIGINS` explícito — sin wildcard `*`

## ⏳ Pendiente para 10/10

### Tests (S4)
- [ ] Unit test `FirebaseAuthGuard` — token válido, token expirado, token revocado
- [ ] Unit test `TenantGuard` — org activa, org inexistente, colaborador sin acceso
- [ ] Unit test `SessionService` — create, verify, revoke
- [ ] Integration test: request sin cookie → 401; con cookie válida → 200
- [ ] Integration test: request con cookie revocada → 401

### Enforcement CI (S4)
- [ ] `dependency-cruiser` rule `no-local-firebase-verify`
  → Falla el build si alguien reimplementa verificación Firebase fuera de `@real/auth-server`

### Decisiones de degradación (documentar antes de lanzamiento)
- [ ] ¿Qué hace el back si Firebase Admin SDK no está disponible? → 503 o 401
- [ ] ¿Health check devuelve `degraded` o `down` si Firebase falla?
- [ ] ¿Qué pasa si `OrganizationsClientService` tarda > 2s en resolver tenant?

## Referencia de archivos

- `packages/auth-server/src/middleware/create-trpc-auth-middleware.ts`
- `packages/auth-server/src/guards/firebase-auth.guard.ts`
- `packages/auth-server/src/session/session.service.ts`
- `packages/auth-server/src/session/auth-session.controller.ts`
- `realsass-sass-back/src/main.ts` — cookieParser + CORS
- `decisions/ADR-003-custom-claims.md`
- `decisions/ADR-004-auth-session-cookies.md`
