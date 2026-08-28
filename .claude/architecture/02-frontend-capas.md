# Frontend — 3 apps (sass-front, dashboard-front, ecommerce-front)

| # | Capa | Ideal terminado | Regla dura | Estado hoy |
|---|------|-----------------|------------|------------|
| 1 | Fetch | Una sola forma: cliente tRPC. Fetch manual solo con TODO documentado. | Un fetch manual nuevo sin comentario `TODO(S-x)` es code review rechazado. | ✅ tRPC en los 3 fronts · chat-ia-client.ts documentado como excepción temporal |
| 2 | TanStack Query | Usado igual en las 3 apps para todo dato de servidor. | Ningún componente hace `useEffect(() => fetch(...))` para datos de servidor. | ✅ use-config.ts + use-auth-trpc.ts (sass-front) · features/*/hooks (dashboard-front) · use-cart + use-customer (ecommerce-front) |
| 3 | Zustand | Solo estado de UI puro. El dato vive en TanStack Query. | Si un store Zustand tiene un campo que también existe en una queryKey, es bug de diseño. | ✅ useShoppingBagStore (ecommerce) · useSidebarStore (dashboard) · useUIStore (sass) |
| 4 | Presentación (Component) | Cero datos mock hardcodeados. Estados loading/error/data explícitos. | Un componente con `const products = [...]` inline mergeado a producción es bug. | ⚠️ checkout-flow.tsx mock WebAuthn · adapters shipping stubs — bloqueados por externos |
| 5 | Auth compartido | `@real/auth-client` como única fuente de Firebase wrapper. | Un `firebase/auth` importado directo en un componente de página es bypass. | ✅ @real/auth-client fuente única · cookies HttpOnly (ADR-004) |

## Regla de rendering — Server vs Client Components

Next.js 15 App Router. No es opcional.

- Server Component (default): datos del back en request inicial, layouts, páginas sin interactividad
- Client Component ('use client'): onClick, onChange, hooks, TanStack Query, Zustand
- NUNCA: useEffect para datos de servidor · 'use client' en layout solo para pasar datos

## Error boundaries — contrato de UI

Todo dato asíncrono tiene los tres estados: `isLoading` → Skeleton · `error` → ErrorState · `data` → render.

## Enforcement (objetivo S4)

- ESLint rule `@real/no-useeffect-fetch`
- ESLint rule `@real/no-inline-mock-data`
