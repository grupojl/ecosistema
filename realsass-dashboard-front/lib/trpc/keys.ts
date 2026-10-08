/**
 * lib/trpc/keys.ts — realsass-dashboard-front
 *
 * Query keys de los procedures que se prefetchean en Server Components.
 * Replican el formato que genera @trpc/react-query para `useQuery` sin input:
 *   [[...path], { type: 'query' }]
 * Se declaran acá (sin importar @trpc/react-query) porque un RSC no puede cargar
 * el módulo React del cliente. Si la key no coincide, el HydrationBoundary no
 * hidrata y el Client Component simplemente fetchea en mount.
 */
export const ecommerceQueryKeys = {
  products: [['adminCatalog', 'list'], { type: 'query' }],
  orders:   [['adminOrders',  'list'], { type: 'query' }],
} as const;
