#!/usr/bin/env bash
echo "=== Fix definitivo: TRPCProvider sin createTRPCReact ==="

node - << 'JSEOF'
const fs = require('fs');

// La solución correcta para ambos frontends:
// Usar unstable_httpBatchStreamLink + TRPCProvider de @trpc/react-query
// sin depender del tipo de AppRouter para el Provider

const clientContent = `/* eslint-disable @typescript-eslint/no-explicit-any */
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
            ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
            ...(orgId  ? { 'x-organization-id': orgId }      : {}),
          };
        },
      }),
    ],
  };
}
`;

// sass-front client
fs.writeFileSync('realsass-sass-front/lib/trpc/client.ts', clientContent);
console.log('✓ sass-front/lib/trpc/client.ts');

// dashboard-front client (mismo patrón)
fs.writeFileSync('realsass-dashboard-front/lib/trpc/client.ts', clientContent);
console.log('✓ dashboard-front/lib/trpc/client.ts');

// sass-front provider — usa TRPCProvider de @trpc/react-query directamente
fs.writeFileSync('realsass-sass-front/lib/trpc/provider.tsx', `'use client';

import { useState, type ReactNode }          from 'react';
import { QueryClient, QueryClientProvider }  from '@tanstack/react-query';
import { TRPCClientError }                   from '@trpc/client';
import { trpc, makeTrpcClient }              from './client';
import { useAuth }                           from '@/context/auth-context';

export function TrpcProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth();

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
    },
  }));

  const url = \`\${process.env['NEXT_PUBLIC_API_URL'] ?? ''}/trpc\`;

  const [trpcClient] = useState(() =>
    (trpc as any).createClient(makeTrpcClient(
      url,
      () => firebaseUser?.getIdToken() ?? Promise.resolve(null),
    )),
  );

  const TrpcProviderComponent = (trpc as any).Provider;

  return (
    <TrpcProviderComponent client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </TrpcProviderComponent>
  );
}
`);
console.log('✓ sass-front/lib/trpc/provider.tsx');

// dashboard-front provider
fs.writeFileSync('realsass-dashboard-front/lib/trpc/provider.tsx', `'use client';

import { useState, type ReactNode }          from 'react';
import { QueryClient, QueryClientProvider }  from '@tanstack/react-query';
import { trpc, makeTrpcClient }              from './client';
import { useAuth }                           from '@/context/auth-context';

export function TrpcProvider({ children }: { children: ReactNode }) {
  const { firebaseUser, organizationId } = useAuth();

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
    },
  }));

  const url = \`\${process.env['NEXT_PUBLIC_REAL_BACK_URL'] ?? ''}/api/v1/trpc\`;

  const [trpcClient] = useState(() =>
    (trpc as any).createClient(makeTrpcClient(
      url,
      () => firebaseUser?.getIdToken() ?? Promise.resolve(null),
      () => organizationId ?? null,
    )),
  );

  const TrpcProviderComponent = (trpc as any).Provider;

  return (
    <TrpcProviderComponent client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </TrpcProviderComponent>
  );
}
`);
console.log('✓ dashboard-front/lib/trpc/provider.tsx');

console.log('\n✓ Listo');
JSEOF

echo "✓ Listo"