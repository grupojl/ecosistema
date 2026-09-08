/**
 * lib/store/client.ts — real-ecommerce-front
 *
 * ADR-005 + ADR-006: Reemplaza el fetch REST manual por tRPC server caller.
 * Todos los datos del storefront se obtienen via EcommerceAppRouter.
 *
 * Tipos inferidos desde EcommerceAppRouter — sin cast as any, sin tipos locales.
 *
 * Excepción documentada (ADR-006): NO hay fetch REST aquí.
 * La única excepción de REST en el ecosistema es el bootstrap de auth
 * (POST /auth/session) en realsass-sass-front/context/auth-context.tsx.
 */
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import type { EcommerceAppRouter }         from '@real/trpc';
import type { inferRouterOutputs }         from '@trpc/server';

// ─── Tipos inferidos end-to-end desde el router ───────────────────────────────
type RouterOutput = inferRouterOutputs<EcommerceAppRouter>;
export type StoreProduct   = RouterOutput['customer']['getProducts'][number];
export type StoreInfo      = RouterOutput['customer']['resolveStore'];
export type CartData       = RouterOutput['customer']['getCart'];

// ─── Cliente server-side (sin React, sin hooks) ───────────────────────────────
function getEcommerceBackUrl(): string {
  const url = process.env['NEXT_PUBLIC_ECOMMERCE_API_URL']
    ?? process.env['ECOMMERCE_API_URL']
    ?? 'http://localhost:3001';
  return `${url}/api/v1/trpc`;
}

function createServerStoreClient() {
  return createTRPCProxyClient<EcommerceAppRouter>({
    links: [
      httpLink({
        url: getEcommerceBackUrl(),
      }),
    ],
  });
}

// ─── API pública — misma firma que el cliente anterior ────────────────────────

/**
 * Obtiene la información pública de la tienda por slug.
 * Reemplaza: GET /ecommerce/public/by-slug/:slug (REST)
 * Ahora usa: trpc.customer.resolveStore
 */
export async function getStoreBySlug(slug: string): Promise<StoreInfo | null> {
  try {
    const client = createServerStoreClient();
    return await client.customer.resolveStore.query({ slug });
  } catch {
    return null;
  }
}

/**
 * Obtiene el catálogo público de una tienda.
 * Reemplaza: GET /ecommerce/public/products/:organizationId (REST)
 * Ahora usa: trpc.customer.getProducts
 */
export async function getPublicProducts(
  organizationId: string,
  options?: { limit?: number; cursor?: string },
): Promise<StoreProduct[]> {
  try {
    const client = createServerStoreClient();
    return await client.customer.getProducts.query({
      organizationId,
      limit:  options?.limit  ?? 20,
      cursor: options?.cursor,
    });
  } catch {
    return [];
  }
}
