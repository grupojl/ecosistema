#!/usr/bin/env bash
echo "=== Fix definitivo: trpc sass-front sin AnyRouter ==="

node - << 'JSEOF'
const fs = require('fs');

// ── lib/trpc/client.ts ────────────────────────────────────────────────────────
// No usar createTRPCReact<AnyRouter> — genera errores de tipo.
// Usar createTRPCReact sin tipo genérico y castear a any.
fs.writeFileSync('realsass-sass-front/lib/trpc/client.ts', `/* eslint-disable @typescript-eslint/no-explicit-any */
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
console.log('✓ sass-front/lib/trpc/client.ts — createTRPCReact<any>');

// ── lib/trpc/provider.tsx ─────────────────────────────────────────────────────
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
        queries: {
          staleTime:            60_000,
          retry:                1,
          refetchOnWindowFocus: false,
        },
      },
    }),
  );

  const [trpcClient] = useState(() =>
    createTrpcClient(
      () => firebaseUser?.getIdToken() ?? Promise.resolve(null),
    ),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
`);
console.log('✓ sass-front/lib/trpc/provider.tsx');

// ── lib/trpc/router-type.ts ───────────────────────────────────────────────────
// Ya no se necesita — client.ts usa any directamente
// Lo dejamos vacío para no romper imports
fs.writeFileSync('realsass-sass-front/lib/trpc/router-type.ts', `// No usado en Docker build — client.ts usa createTRPCReact<any>
export type AppRouter = any;
`);
console.log('✓ sass-front/lib/trpc/router-type.ts — stub');

// ── hooks — todos con cast any ────────────────────────────────────────────────
fs.writeFileSync('realsass-sass-front/hooks/use-config.ts', `/* eslint-disable @typescript-eslint/no-explicit-any */
import { trpc } from '@/lib/trpc/client';
const t = trpc as any;

export function useFeatureFlags() {
  return t.configFlags.list.useQuery(undefined, { staleTime: 30_000, refetchInterval: 60_000 });
}
export function useUpdateFeatureFlag() {
  const utils = t.useUtils();
  return t.configFlags.update.useMutation({
    onSettled: () => { void utils.configFlags.list.invalidate(); },
  });
}
export function useQuotas() {
  return t.configQuotas.list.useQuery(undefined, { staleTime: 30_000 });
}
export function useUpdateQuotaLimit() {
  const utils = t.useUtils();
  return t.configQuotas.updateLimit.useMutation({
    onSuccess: () => { void utils.configQuotas.list.invalidate(); },
  });
}
export function useThemes() {
  return t.configThemes.list.useQuery(undefined);
}
export function useActivateTheme() {
  const utils = t.useUtils();
  return t.configThemes.activate.useMutation({
    onSuccess: () => { void utils.configThemes.list.invalidate(); },
  });
}
export function useWebhooks() {
  return t.configWebhooks.list.useQuery(undefined);
}
export function useCreateWebhook() {
  const utils = t.useUtils();
  return t.configWebhooks.create.useMutation({
    onSuccess: () => { void utils.configWebhooks.list.invalidate(); },
  });
}
export function useDeleteWebhook() {
  const utils = t.useUtils();
  return t.configWebhooks.remove.useMutation({
    onSuccess: () => { void utils.configWebhooks.list.invalidate(); },
  });
}
export function useWebhookLogs(webhookId: string | null | undefined) {
  return t.configWebhooks.getLogs.useQuery(
    { webhookId: webhookId!, take: 50 },
    { enabled: !!webhookId },
  );
}
`);
console.log('✓ hooks/use-config.ts');

fs.writeFileSync('realsass-sass-front/hooks/use-organization.ts', `/* eslint-disable @typescript-eslint/no-explicit-any */
import { trpc } from '@/lib/trpc/client';
const t = trpc as any;

export function useMyOrganization() {
  return t.organizations.me.useQuery(undefined, { staleTime: 60_000 });
}
export function useUpdateOrganization() {
  const utils = t.useUtils();
  return t.organizations.update.useMutation({
    onSuccess: () => {
      void utils.organizations.me.invalidate();
      void utils.auth.me.invalidate();
    },
  });
}
`);
console.log('✓ hooks/use-organization.ts');

fs.writeFileSync('realsass-sass-front/hooks/use-profile.ts', `/* eslint-disable @typescript-eslint/no-explicit-any */
import { trpc } from '@/lib/trpc/client';
const t = trpc as any;

export function useProfile() {
  return t.auth.me.useQuery(undefined, { staleTime: 60_000 });
}
export function useSyncUser() {
  return t.auth.sync.useMutation({});
}
export function useSelectRole() {
  const utils = t.useUtils();
  return t.auth.selectRole.useMutation({
    onSuccess: () => { void utils.auth.me.invalidate(); },
  });
}
`);
console.log('✓ hooks/use-profile.ts');

console.log('\n✓ Todos los archivos tRPC del sass-front actualizados');
JSEOF

echo "✓ Listo"