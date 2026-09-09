# Frontend Capa 2 — TanStack Query
# Checklist 10/10

**Score actual: 9/10 — nivel Linear/Vercel**
**Score objetivo: 10/10**

## ✅ Completado

- [ ] `use-config.ts` — tipado sin any, inferido desde SassAppRouter
- [ ] `use-auth-trpc.ts` — me, sync, refreshClaims, selectRole
- [ ] `use-collaborators.ts` — list, invite, update, remove, accept, getInvitationInfo
- [ ] `features/*/hooks` en dashboard-front — TanStack Query en todas las páginas de datos
- [ ] `use-cart` + `use-customer` en ecommerce-front
- [ ] `staleTime` configurado por entidad según frecuencia de cambio
- [ ] `queryKey` invalidation en mutations — cero datos stale
- [ ] Sin `useEffect(() => fetch(...))` para datos de servidor

## ⏳ Pendiente para 10/10

### Server prefetch con HydrationBoundary (S4)
- [ ] Server Components prefetchean con `createServerCaller()` + `dehydrate(queryClient)`
- [ ] Client Components rehidratan con `<HydrationBoundary>` — cero loading flash
- [ ] Páginas de catálogo del storefront: datos disponibles en el HTML inicial (SSR real)

### Enforcement CI (S4)
- [ ] ESLint rule `@real/no-useeffect-fetch`
  → Detecta `useEffect` con `fetch` o `trpc` sin `// @real/polling-intent`

## Regla dura

Todo dato de servidor tiene una `queryKey` registrada y vive en TanStack Query.
Si un dato existe tanto en un store Zustand como en una queryKey → bug de diseño.
