/**
 * lib/store/resolver.ts — real-ecommerce-front
 *
 * tRPC server caller (ADR-005 + ADR-007). StoreInfo viene de inferRouterOutputs.
 *
 * React `cache()`: layout + page + generateMetadata llaman resolveStore con
 * el mismo slug en el mismo request → antes eran 3-4 llamadas HTTP (y cada
 * una, otra a sass-back). Ahora 1 por request.
 *
 * Semántica de errores (SEO):
 *   NOT_FOUND  → null  → notFound() → 404 (Google desindexa: correcto).
 *   cualquier otro → se relanza → 5xx (Google reintenta y CONSERVA el índice).
 *   Antes un catch-all devolvía null: una caída de sass-back = 404 masivo.
 */
import { cache } from 'react';
import { TRPCClientError } from '@trpc/client';
import { createStoreCaller } from '@/lib/trpc/server';
import type { StoreInfo } from '@/lib/trpc/types';

export type { StoreInfo };

export function trpcErrorCode(err: unknown): string | null {
  if (!(err instanceof TRPCClientError)) return null;
  const data: unknown = err.data;
  if (typeof data === 'object' && data !== null && 'code' in data && typeof data.code === 'string') {
    return data.code;
  }
  return null;
}

export const resolveStore = cache(async (slug: string): Promise<StoreInfo | null> => {
  try {
    const caller = createStoreCaller();
    return await caller.customer.resolveStore.query({ slug });
  } catch (err) {
    if (trpcErrorCode(err) === 'NOT_FOUND') return null;
    throw err;
  }
});
