# Frontend Capa 1 — Fetch tRPC exclusivo
# Checklist 10/10

**Score actual: 9.5/10 — nivel Vercel**
**Score objetivo: 10/10**
**Última actualización:** 2026-09-02

## ✅ Completado

- [x] tRPC exclusivo en sass-front, dashboard-front y ecommerce-front
- [x] `credentials: include` — cookie `__session` viaja automáticamente
- [x] Excepción técnica documentada: `POST/DELETE /auth/session` — ADR-004
  → REST por diseño — necesita `Set-Cookie` header, tRPC no puede setearlo
- [x] `chat-ia-client.ts` documentado con TODO explícito (excepción temporal)
- [x] Sin `lib/api.ts`, `lib/types.ts`, `lib/firebase.ts` en sass-front
- [x] `lib/firebase.ts` eliminado de dashboard-front — usa `@real/auth-client` directo
- [x] `lib/store/client.ts` → usa `createStoreCaller().customer.*` (tRPC server caller)
- [x] `lib/store/resolver.ts` → usa `customer.resolveStore` procedure
- [x] `context/customer-context.tsx` → `identifyCustomer()` usa `customer.identify` tRPC
- [x] `lib/ecommerce/index.ts` (shim) eliminado
- [x] Páginas legacy `/categoria/` y `/products/` → redirect 308 (sin fetch de negocio)
- [x] `dashboard-front/app/auth/sso/page.tsx` → usa `@real/auth-client` (migrado de Firebase directo)
- [x] 0 fetch manuales de negocio en los 3 fronts

## Excepciones permanentes documentadas

| Fetch | Por qué REST | Archivo |
|---|---|---|
| `POST /auth/session` | Bootstrap cookie HttpOnly — Set-Cookie header (ADR-004) | `auth-context.tsx` |
| `DELETE /auth/session` | Revocación cookie HttpOnly — mismo motivo | `auth-context.tsx` |
| `chat-ia-client.ts` | chat-ia-back sin router tRPC todavía | `lib/chat-ia-client.ts` |

## ⏳ Pendiente para 10/10

### Modelo Server/Client Components — HydrationBoundary (S4)
- [ ] Server Components usan `createServerCaller()` tRPC — no fetch manual
- [ ] `<HydrationBoundary>` para pasar datos del server al client sin re-fetch
- [ ] Client Components rehidratan con misma queryKey — cero loading flash inicial

### Enforcement CI (S4)
- [ ] ESLint rule `@real/no-bare-fetch`
  → Falla si hay `fetch()` sin comentario `// @real/exception: <razón>`

### Migrar chat cuando esté listo
- [ ] Eliminar `lib/chat-ia-client.ts` cuando chat-ia-back exponga router tRPC

## Regla dura

Todo fetch manual sin justificación documentada es un bug de arquitectura.
Excepción permanente: `POST/DELETE /auth/session` — bootstrap de cookies HttpOnly (ADR-004).
Excepción temporal: `chat-ia-client.ts` — hasta que chat-ia-back tenga tRPC.

## Referencia de archivos

- `real-ecommerce-front/lib/trpc/server.ts` — createStoreCaller()
- `real-ecommerce-front/lib/trpc/types.ts` — tipos inferidos sin duplicación
- `real-ecommerce-front/context/customer-context.tsx` — identifyCustomer() tRPC
- `realsass-sass-front/context/auth-context.tsx` — excepciones REST documentadas
- `realsass-dashboard-front/app/auth/sso/page.tsx` — @real/auth-client migrado
- `decisions/ADR-004-auth-session-cookies.md`
- `decisions/ADR-005-rest-to-trpc.md`
- `decisions/ADR-006-front-cleanup.md`
