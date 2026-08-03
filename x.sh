#!/usr/bin/env bash
echo "=== Fix: provider.tsx sass-front sin organizationId ==="

node - << 'JSEOF'
const fs = require('fs');

fs.writeFileSync('realsass-sass-front/lib/trpc/provider.tsx', [
  "'use client';",
  "",
  "import { useState }                         from 'react';",
  "import { QueryClient, QueryClientProvider } from '@tanstack/react-query';",
  "import { trpc, createTrpcClient }           from './client';",
  "import { useAuth }                          from '@/context/auth-context';",
  "",
  "export function TrpcProvider({ children }: { children: React.ReactNode }) {",
  "  const { firebaseUser } = useAuth();",
  "",
  "  const [queryClient] = useState(() =>",
  "    new QueryClient({",
  "      defaultOptions: {",
  "        queries: {",
  "          staleTime:            60_000,",
  "          retry:                1,",
  "          refetchOnWindowFocus: false,",
  "        },",
  "      },",
  "    }),",
  "  );",
  "",
  "  const [trpcClient] = useState(() =>",
  "    createTrpcClient(",
  "      () => firebaseUser?.getIdToken() ?? Promise.resolve(null),",
  "    ),",
  "  );",
  "",
  "  return (",
  "    <trpc.Provider client={trpcClient} queryClient={queryClient}>",
  "      <QueryClientProvider client={queryClient}>",
  "        {children}",
  "      </QueryClientProvider>",
  "    </trpc.Provider>",
  "  );",
  "}",
].join('\n'));
console.log('✓ sass-front/lib/trpc/provider.tsx — sin organizationId');
JSEOF

echo "✓ Listo"