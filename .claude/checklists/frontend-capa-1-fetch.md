# Frontend Capa 1 — Fetch tRPC exclusivo
# Checklist 10/10

**Score actual: 7.5/10 — nivel Notion/Linear**
**Score objetivo: 10/10 — nivel Vercel**

## ✅ Completado

- [x] tRPC exclusivo en sass-front y dashboard-front
- [x] `credentials: include` — cookie `__session` viaja automáticamente
- [x] Excepción técnica documentada: `POST/DELETE /auth/session` — ADR-004
- [x] `chat-ia-client.ts` documentado con TODO explícito (excepción temporal)
- [x] Sin `lib/api.ts`, `lib/types.ts`, `lib/firebase.ts` en sass-front

## ⏳ Pendiente para 10/10

### ecommerce-front — migración a tRPC server caller (BLOQUEANTE)
- [ ] Agregar en ecommerce-back: `customer.resolveStore` procedure
- [ ] Agregar en ecommerce-back: `customer.identify` procedure
- [ ] Agregar en ecommerce-back: `customer.getProducts` / `customer.getCategories`
- [x] Reemplazar `lib/store/client.ts` → `createServerCaller().customer.*`
- [x] Reemplazar `lib/store/resolver.ts` → `customer.resolveStore`
- [x] lib/store/ migrado a tRPC server caller `identifyCustomer()` → `customer.identify`
- [ ] Migrar páginas legacy `/categoria/` y `/products/` a `/tienda/[slug]/`
- [ ] Eliminar `lib/ecommerce/index.ts` (shim) y `lib/store/client.ts`

### Modelo Server/Client Components (S4)
- [ ] Server Components usan `createServerCaller()` tRPC — no fetch manual
- [ ] `<HydrationBoundary>` para pasar datos del server al client sin re-fetch
- [ ] Client Components rehidratan con misma queryKey — cero fetch propio

### Enforcement CI (S4)
- [ ] ESLint rule `@real/no-bare-fetch`
  → Falla si hay `fetch()` sin comentario `// TODO(S-x): migrar a tRPC`

## Regla dura

Todo fetch manual sin justificación documentada es un bug de arquitectura.
Excepción permanente: `POST/DELETE /auth/session` — bootstrap de cookies HttpOnly (ADR-004).
