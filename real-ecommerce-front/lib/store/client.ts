/**
 * lib/store/client.ts — real-ecommerce-front
 *
 * MIGRADO a tRPC server caller (ADR-005 + ADR-007).
 *
 * Los tipos vienen de lib/trpc/types.ts (inferRouterOutputs) — sin duplicación.
 * Si el back cambia un campo, TypeScript lo detecta aquí automáticamente.
 */
import { createStoreCaller } from '@/lib/trpc/server';
import type { StoreProduct, StoreCategory } from '@/lib/trpc/types';

export type { StoreProduct, StoreCategory };

export async function getProducts(
  organizationId: string,
  params?: { category?: string },
): Promise<StoreProduct[]> {
  const caller = createStoreCaller(organizationId);
  const result = await caller.customer.getProducts({ organizationId, category: params?.category });
  return result;
}

export async function getProductByHandle(
  organizationId: string,
  handle: string,
): Promise<StoreProduct | null> {
  try {
    const caller = createStoreCaller(organizationId);
    return await caller.customer.getProduct({ organizationId, handle });
  } catch {
    return null;
  }
}

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
  const cats = await getCategories(organizationId);
  return cats.find(c => c.handle === handle) ?? null;
}
