#!/usr/bin/env bash
echo "=== Fix: client.ts sin trpc.createClient ==="

node - << 'JSEOF'
const fs = require('fs');

fs.writeFileSync('realsass-sass-front/lib/trpc/client.ts', `/* eslint-disable @typescript-eslint/no-explicit-any */
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
        url: \`\${base}/trpc\`,
        async headers() {
          const token = await getToken();
          const orgId = getOrganizationId();
          return {
            ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
            ...(orgId  ? { 'x-organization-id': orgId }      : {}),
          };
        },
      }),
    ],
  });
}
`);
console.log('✓ client.ts — usa createTRPCClient en vez de trpc.createClient');

// provider.tsx — usa trpc.Provider que sí existe en createTRPCReact<any>
fs.writeFileSync('realsass-sass-front/lib/trpc/provider.tsx', `'use client';

import { useState }                         from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, createTrpcClient }           from './client';
import { useAuth }                          from '@/context/auth-context';

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();

  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
      },
    }),
  );

  const [trpcClient] = useState(() =>
    createTrpcClient(
      () => firebaseUser?.getIdToken() ?? Promise.resolve(null),
    ),
  );

  return (
    <trpc.Provider client={trpcClient as any} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
`);
console.log('✓ provider.tsx — client casteado a any');

console.log('\n✓ Listo');
JSEOF

echo "✓ Listo"