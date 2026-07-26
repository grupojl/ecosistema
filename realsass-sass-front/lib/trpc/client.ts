'use client';

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink }   from '@trpc/client';
import type { AnyRouter }  from '@trpc/server';

export const trpc = createTRPCReact<AnyRouter>();

export function createTrpcClient(getToken: () => Promise<string | null>) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env['NEXT_PUBLIC_API_URL']}/trpc`,
        async headers() {
          const token = await getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}