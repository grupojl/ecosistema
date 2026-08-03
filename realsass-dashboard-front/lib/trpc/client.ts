/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink }   from '@trpc/client';

// Usamos un tipo vacío para evitar el error de AnyRouter en Docker.
// En runtime tRPC solo necesita la URL — los tipos son solo para DX local.
type RouterType = any;

export const trpc = createTRPCReact<RouterType>() as any;

export function makeTrpcClient(
  url: string,
  getToken:          () => Promise<string | null>,
  getOrganizationId: () => string | null = () => null,
) {
  return {
    links: [
      httpBatchLink({
        url,
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
  };
}
