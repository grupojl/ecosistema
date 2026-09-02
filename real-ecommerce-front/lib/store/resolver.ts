/**
 * lib/store/resolver.ts — real-ecommerce-front
 *
 * MIGRADO a tRPC server caller (ADR-005 + ADR-007).
 * StoreInfo viene de inferRouterOutputs — sin duplicación de tipos.
 */
import { createStoreCaller } from '@/lib/trpc/server';
import type { StoreInfo }    from '@/lib/trpc/types';

export type { StoreInfo };

export async function resolveStore(slug: string): Promise<StoreInfo | null> {
  try {
    const caller = createStoreCaller();
    return await caller.customer.resolveStore({ slug });
  } catch {
    return null;
  }
}
