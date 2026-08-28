# ADR-004: Migración de Bearer token a cookies HttpOnly para auth de sesión

**Fecha:** 2026-08-27
**Estado:** Aceptado — implementado en S4

## Contexto

El sistema de auth actual funciona así:

1. El usuario se autentica con Firebase Authentication (Google/Apple/Facebook)
2. Firebase SDK devuelve un ID token (JWT, 55 min de vida)
3. El front llama `getIdToken()` en cada request tRPC y lo envía como
   `Authorization: Bearer <token>` en el header
4. El backend verifica el token con Firebase Admin SDK

Este modelo tiene dos vulnerabilidades:

**Vulnerabilidad 1 — XSS puede exfiltrar el token:**
El token vive en memoria del proceso JS (Firebase SDK lo cachea internamente).
Si hay XSS, el atacante puede llamar `firebase.auth().currentUser.getIdToken()`
desde código inyectado y obtener el token válido.

**Vulnerabilidad 2 — Sin refresh automático mid-session:**
Si el token expira (55 min) mientras el usuario está activo, la siguiente
llamada tRPC devuelve 401. El cliente tRPC no tiene interceptor de refresh
configurado — el usuario ve un error en lugar de un refresh transparente.

## Decisión

Migrar de Bearer token a cookies HttpOnly para las sesiones de dashboard
(`realsass-sass-front`, `realsass-dashboard-front`).

El flujo propuesto:

```
1. Usuario hace login con Firebase → obtiene ID token
2. Front llama POST /auth/session con el ID token en el body
3. Back verifica con Firebase Admin, emite cookie HttpOnly
   (Firebase Session Cookie — hasta 2 semanas, verificable en back sin
   round-trip extra a Firebase)
4. Todas las llamadas tRPC posteriores van sin Authorization header —
   la cookie viaja automáticamente con credentials: 'include'
5. Logout: DELETE /auth/session → back invalida la cookie
```

**Para real-ecommerce-front (storefront público):**
No aplica — el storefront usa customerId + sessionId, no Firebase.

## Alternativas descartadas

- **Refresh automático solamente (sin cookies HttpOnly):**
  Resuelve Vulnerabilidad 2 pero no Vulnerabilidad 1. Válido como mejora
  incremental mientras se implementa este ADR, pero no como solución final.

- **localStorage para persistir token entre tabs:**
  Peor que el modelo actual — accesible por JS y persiste entre sesiones.

- **JWT propio en lugar de Firebase Session Cookies:**
  Innecesaria complejidad — Firebase Admin ya provee session cookies
  verificables, revocables y con expiración configurable.

## Consecuencias

**Ganancia:**
- Token inaccesible para JS → XSS no puede exfiltrarlo
- SameSite=Strict previene CSRF en la mayoría de escenarios
- Refresh transparente desde el back
- Invalidación server-side real (logout revoca la cookie en Firebase)

**Costo / deuda técnica consciente:**
- Endpoint nuevo en cada back: POST /auth/session + DELETE /auth/session
- CORS con `credentials: true` y origin explícito — incompatible con
  `origin: '*'` actual (documentado en deuda-tecnica.md como bug)
- Cliente tRPC necesita `fetch: (url, opts) => fetch(url, {...opts, credentials: 'include'})`
- Complejidad en desarrollo local (cookies requieren HTTPS o config especial)
- Firebase Session Cookies: máximo 2 semanas → manejar expiración y re-login

**Se posterga hasta:** S4 o antes de lanzamiento con datos sensibles en producción.

## Implementación de referencia

```typescript
// Back: POST /auth/session
@Post('session')
@Public()
async createSession(@Body('idToken') idToken: string, @Res() res: Response) {
  const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 días
  const sessionCookie = await this.firebaseAdmin
    .auth()
    .createSessionCookie(idToken, { expiresIn });

  res.cookie('__session', sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: expiresIn,
    path: '/',
  });

  return res.json({ ok: true });
}

// Back: verificación en middleware
const sessionCookie = req.cookies['__session'];
const decoded = await firebaseAdmin.auth().verifySessionCookie(sessionCookie, true);
req.user = { uid: decoded.uid, email: decoded.email };
```

```typescript
// Front: cliente tRPC con credentials
httpBatchLink({
  url: `${getBackUrl()}/api/v1/trpc`,
  fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' }),
})
```

## Referencias

- `packages/auth-server/src/middleware/create-trpc-auth-middleware.ts`
- `realsass-sass-back/src/main.ts` — CORS actual (origin: '*' — bug)
- `realsass-ecommerce-back/src/main.ts` — ídem
- `realsass-sass-front/lib/trpc/client.ts` — httpBatchLink actual
- `realsass-dashboard-front/lib/trpc/client.ts` — ídem
- Firebase Session Cookies: https://firebase.google.com/docs/auth/admin/manage-cookies
- `roadmap/deuda-tecnica.md` — sección "Auth — gaps para llegar a 10/10"
