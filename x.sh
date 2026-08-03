#!/usr/bin/env bash
echo "=== Fix: client.ts sass-front con cast any ==="

node - << 'JSEOF'
const fs = require('fs');

fs.writeFileSync('realsass-sass-front/lib/trpc/client.ts', [
  "/* eslint-disable @typescript-eslint/no-explicit-any */",
  "'use client';",
  "",
  "import { createTRPCReact } from '@trpc/react-query';",
  "import { httpBatchLink }   from '@trpc/client';",
  "import type { AppRouter }  from './router-type';",
  "",
  "export const trpc = createTRPCReact<AppRouter>();",
  "",
  "export function createTrpcClient(",
  "  getToken:          () => Promise<string | null>,",
  "  getOrganizationId: () => string | null = () => null,",
  ") {",
  "  const base = process.env['NEXT_PUBLIC_API_URL'] ?? '';",
  "  return (trpc as any).createClient({",
  "    links: [",
  "      httpBatchLink({",
  "        url: `${base}/trpc`,",
  "        async headers() {",
  "          const token = await getToken();",
  "          const orgId = getOrganizationId();",
  "          return {",
  "            ...(token ? { Authorization: `Bearer ${token}` } : {}),",
  "            ...(orgId  ? { 'x-organization-id': orgId }      : {}),",
  "          };",
  "        },",
  "      }),",
  "    ],",
  "  });",
  "}",
].join('\n'));
console.log('✓ sass-front/lib/trpc/client.ts — createClient con cast any');

// Mismo fix para dashboard-front
fs.writeFileSync('realsass-dashboard-front/lib/trpc/client.ts', [
  "/* eslint-disable @typescript-eslint/no-explicit-any */",
  "'use client';",
  "",
  "import { createTRPCReact } from '@trpc/react-query';",
  "import { httpBatchLink }   from '@trpc/client';",
  "import type { AppRouter }  from './router-type';",
  "",
  "export const trpc = createTRPCReact<AppRouter>();",
  "",
  "export function createTrpcClient(",
  "  getToken:          () => Promise<string | null>,",
  "  getOrganizationId: () => string | null,",
  ") {",
  "  const base = process.env['NEXT_PUBLIC_REAL_BACK_URL'] ?? '';",
  "  return (trpc as any).createClient({",
  "    links: [",
  "      httpBatchLink({",
  "        url: `${base}/api/v1/trpc`,",
  "        async headers() {",
  "          const token = await getToken();",
  "          const orgId = getOrganizationId();",
  "          return {",
  "            ...(token ? { Authorization: `Bearer ${token}` } : {}),",
  "            ...(orgId  ? { 'x-organization-id': orgId }      : {}),",
  "          };",
  "        },",
  "      }),",
  "    ],",
  "  });",
  "}",
].join('\n'));
console.log('✓ dashboard-front/lib/trpc/client.ts — createClient con cast any');

console.log('\n✓ Listo');
JSEOF

echo "✓ Listo"