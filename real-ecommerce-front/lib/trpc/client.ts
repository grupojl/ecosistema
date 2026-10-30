/**
 * lib/trpc/client.ts — real-ecommerce-front
 *
 * Cliente tRPC React para el storefront público.
 * Conecta con realsass-ecommerce-back en /api/v1/trpc.
 *
 * Headers por request:
 *   x-organization-id: fijo desde NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID
 *   x-customer-id:     customerId del cliente (CustomerContext, sin Firebase)
 *
 * Sin Authorization — los clientes del storefront no usan Firebase.
 */
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink }   from '@trpc/client';
import type { AppRouter }  from '@/lib/trpc/router-type';
import { useMarketStore }  from '@/stores/use-market-store';
import { visitorCountryHeader } from '@/lib/market/visitor-country-header';

export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient(getCustomerId: () => string | null) {
  const orgId = process.env.NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID ?? '';

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ?? ''}/api/v1/trpc`,
        headers() {
          const customerId = getCustomerId();
          const result: Record<string, string> = {};
          if (orgId)      result['x-organization-id'] = orgId;
          if (customerId) result['x-customer-id']      = customerId;
          return { ...result, ...visitorCountryHeader(useMarketStore.getState().currentCountry) };
        },
      }),
    ],
  });
}

/** Base del back sin barra final ni /api/v1 (se tolera que la variable ya lo traiga). */
function ecommerceBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_ECOMMERCE_API_URL ?? '').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
}

/**
 * Cliente para las páginas de UNA tienda (/{locale}/{slug}/...).
 *
 * La organización sale de la tienda que se está viendo (no de una variable de entorno global, que solo servía para
 * una tienda). La identidad del cliente es su token de Firebase (ADR-021): se pide en cada request, así siempre va el
 * vigente y el back deriva el cliente de ahí (ya no existe el header x-customer-id).
 */
export function createStoreTrpcClient(opts: {
  getOrganizationId: () => string;
  getIdToken:        () => Promise<string | null>;
}) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${ecommerceBaseUrl()}/api/v1/trpc`,
        async headers() {
          const token = await opts.getIdToken();
          return {
            'x-organization-id': opts.getOrganizationId(),
            ...visitorCountryHeader(useMarketStore.getState().currentCountry), // ADR-014: el back resuelve el Market de la orden
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          };
        },
      }),
    ],
  });
}
