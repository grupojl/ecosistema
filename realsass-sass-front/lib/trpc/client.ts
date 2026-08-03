/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink }   from '@trpc/client';

// Cast a any para evitar conflictos con AnyRouter en Docker build.
// En dev local se usa el tipo real desde packages/trpc.
// En runtime solo importa la URL — los tipos no existen.
export const trpc = createTRPCReact<any>();

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
