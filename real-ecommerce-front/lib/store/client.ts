/**
 * lib/store/client.ts — real-ecommerce-front
 *
 * tRPC server caller (ADR-005 + ADR-007). Tipos de lib/trpc/types.ts.
 * `cache()` deduplica por request (getCategories reutiliza getProducts).
 */
import { cache } from 'react';
import { createStoreCaller } from '@/lib/trpc/server';
import type { StoreProduct, StoreCategory } from '@/lib/trpc/types';
import { trpcErrorCode } from '@/lib/store/resolver';

export type { StoreProduct, StoreCategory };

export const getProducts = cache(async (
  organizationId: string,
  category?: string,
): Promise<StoreProduct[]> => {
  const caller = createStoreCaller(organizationId);
  return caller.customer.getProducts.query({ organizationId, category });
});

export const getProductByHandle = cache(async (
  organizationId: string,
  handle: string,
): Promise<StoreProduct | null> => {
  try {
    const caller = createStoreCaller(organizationId);
    return await caller.customer.getProduct.query({ organizationId, handle });
  } catch (err) {
    if (trpcErrorCode(err) === 'NOT_FOUND') return null;
    throw err;
  }
});

export async function getCategories(organizationId: string): Promise<StoreCategory[]> {
  const products = await getProducts(organizationId);
  const seen = new Map<string, StoreCategory>();
  for (const p of products) {
    if (p.category && !seen.has(p.category.id)) {
      seen.set(p.category.id, p.category);
    }
  }
  return Array.from(seen.values());
}

export async function getCategoryByHandle(
  organizationId: string,
  handle: string,
): Promise<StoreCategory | null> {
  const categories = await getCategories(organizationId);
  return categories.find((c) => c.handle === handle) ?? null;
}
