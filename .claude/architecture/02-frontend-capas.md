# Frontend — 3 apps (sass-front, dashboard-front, ecommerce-front)

| # | Capa | Ideal terminado | Regla dura | Estado hoy |
|---|------|-----------------|------------|------------|
| 1 | Fetch | tRPC exclusivo. Server Components usan createServerCaller(). Client Components rehidratan — no fetch propio. REST solo para bootstrap de cookies (ADR-004). | Ningún fetch manual sin justificación documentada. | ✅ completo en los 3 fronts — 0 fetch REST de negocio. Excepción documentada: POST/DELETE /auth/session (ADR-004) + chat-ia-client.ts (temporal) |
| 2 | TanStack Query | Todo dato de servidor en TanStack Query con queryKey explícita. | Ningún componente hace `useEffect(() => fetch(...))` para datos de servidor. | ✅ use-config.ts + use-auth-trpc.ts (sass-front) · features/*/hooks (dashboard-front) · use-cart + use-customer (ecommerce-front) |
| 3 | Zustand | Solo estado de UI puro. El dato vive en TanStack Query. | Si un store Zustand tiene un campo que también existe en una queryKey, es bug de diseño. | ✅ useShoppingBagStore (ecommerce) · useSidebarStore (dashboard) · useUIStore (sass) |
| 4 | Presentación (Component) | Cero datos mock hardcodeados. Estados loading/error/data explícitos. | Un componente con `const products = [...]` inline mergeado a producción es bug. | ⚠️ checkout-flow.tsx mock WebAuthn · adapters shipping stubs — bloqueados por externos |
| 5 | Auth compartido | `@real/auth-client` como única fuente de Firebase wrapper. | Un `firebase/auth` importado directo en un componente de página es bypass. | ✅ @real/auth-client fuente única en los 3 fronts · cookies HttpOnly (ADR-004) |

## Modelo de rendering — canónico

```
Server Component (default, sin 'use client')
  → await createServerCaller().procedure({ ... })
  → <HydrationBoundary state={dehydrate(queryClient)}>
      <ClientComponent />
    </HydrationBoundary>

Client Component ('use client')
  → trpc.namespace.procedure.useQuery()   ← rehidrata, no refetch inicial
  → NUNCA fetch propio · NUNCA useEffect con fetch
```

**Regla dura:** si un dato puede venir del server, viene del server.
El client solo rehidrata — no es responsable de obtener datos.

## Error boundaries — contrato de UI

Todo dato asíncrono tiene los tres estados obligatorios:
- `isLoading` → `<Skeleton />`
- `error` → `<ErrorState message={...} />`
- `data` → render del componente

## Enforcement objetivo (S4)

- ESLint rule `@real/no-useeffect-fetch`
- ESLint rule `@real/no-inline-mock-data`
- ESLint rule `@real/no-bare-fetch` (fetch sin TODO documentado)
