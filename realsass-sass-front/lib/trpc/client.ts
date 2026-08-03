/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { createTRPCReact }  from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';

export const trpc = createTRPCReact<any>();

export function createTrpcClient(
  getToken:          () => Promise<string | null>,
  getOrganizationId: () => string | null = () => null,
) {
  const base = process.env['NEXT_PUBLIC_API_URL'] ?? '';
  return createTRPCClient<any>({
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
