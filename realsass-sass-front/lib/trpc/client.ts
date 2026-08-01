'use client';

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink }   from '@trpc/client';
import type { AppRouter }  from './router-type';

export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient(
  getToken:          () => Promise<string | null>,
  getOrganizationId: () => string | null = () => null,
) {
  const base = process.env['NEXT_PUBLIC_API_URL'] ?? '';
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${base}/trpc`,
        async headers() {
          const token = await getToken();
          const orgId = getOrganizationId();
          return {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(orgId  ? { 'x-organization-id': orgId }      : {}),
          };
        },
      }),
    ],
  });
}