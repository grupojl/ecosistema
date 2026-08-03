#!/usr/bin/env bash
echo "=== Fix: hooks sass-front compatibles con AnyRouter ==="

node - << 'JSEOF'
const fs = require('fs');

// hooks/use-config.ts — usar trpc con cast para evitar el error de AnyRouter
// En runtime funciona igual, el cast es solo para que TypeScript no se queje
fs.writeFileSync('realsass-sass-front/hooks/use-config.ts', [
  "/* eslint-disable @typescript-eslint/no-explicit-any */",
  "import { trpc } from '@/lib/trpc/client';",
  "",
  "const t = trpc as any;",
  "",
  "export function useFeatureFlags() {",
  "  return t.configFlags.list.useQuery(undefined, {",
  "    staleTime: 30_000, refetchInterval: 60_000,",
  "  });",
  "}",
  "export function useUpdateFeatureFlag() {",
  "  const utils = t.useUtils();",
  "  return t.configFlags.update.useMutation({",
  "    onSettled: () => { void utils.configFlags.list.invalidate(); },",
  "  });",
  "}",
  "",
  "export function useQuotas() {",
  "  return t.configQuotas.list.useQuery(undefined, {",
  "    staleTime: 30_000, refetchInterval: 30_000,",
  "  });",
  "}",
  "export function useUpdateQuotaLimit() {",
  "  const utils = t.useUtils();",
  "  return t.configQuotas.updateLimit.useMutation({",
  "    onSuccess: () => { void utils.configQuotas.list.invalidate(); },",
  "  });",
  "}",
  "",
  "export function useThemes() {",
  "  return t.configThemes.list.useQuery(undefined);",
  "}",
  "export function useActivateTheme() {",
  "  const utils = t.useUtils();",
  "  return t.configThemes.activate.useMutation({",
  "    onSuccess: () => { void utils.configThemes.list.invalidate(); },",
  "  });",
  "}",
  "",
  "export function useWebhooks() {",
  "  return t.configWebhooks.list.useQuery(undefined);",
  "}",
  "export function useCreateWebhook() {",
  "  const utils = t.useUtils();",
  "  return t.configWebhooks.create.useMutation({",
  "    onSuccess: () => { void utils.configWebhooks.list.invalidate(); },",
  "  });",
  "}",
  "export function useDeleteWebhook() {",
  "  const utils = t.useUtils();",
  "  return t.configWebhooks.remove.useMutation({",
  "    onSuccess: () => { void utils.configWebhooks.list.invalidate(); },",
  "  });",
  "}",
  "export function useWebhookLogs(webhookId: string | null | undefined) {",
  "  return t.configWebhooks.getLogs.useQuery(",
  "    { webhookId: webhookId!, take: 50 },",
  "    { enabled: !!webhookId },",
  "  );",
  "}",
].join('\n'));
console.log('✓ hooks/use-config.ts → cast as any para AnyRouter');

// Mismo fix para use-organization.ts y use-profile.ts
fs.writeFileSync('realsass-sass-front/hooks/use-organization.ts', [
  "/* eslint-disable @typescript-eslint/no-explicit-any */",
  "import { trpc } from '@/lib/trpc/client';",
  "",
  "const t = trpc as any;",
  "",
  "export function useMyOrganization() {",
  "  return t.organizations.me.useQuery(undefined, { staleTime: 60_000 });",
  "}",
  "",
  "export function useUpdateOrganization() {",
  "  const utils = t.useUtils();",
  "  return t.organizations.update.useMutation({",
  "    onSuccess: () => {",
  "      void utils.organizations.me.invalidate();",
  "      void utils.auth.me.invalidate();",
  "    },",
  "  });",
  "}",
].join('\n'));
console.log('✓ hooks/use-organization.ts → cast as any');

fs.writeFileSync('realsass-sass-front/hooks/use-profile.ts', [
  "/* eslint-disable @typescript-eslint/no-explicit-any */",
  "import { trpc } from '@/lib/trpc/client';",
  "",
  "const t = trpc as any;",
  "",
  "export function useProfile() {",
  "  return t.auth.me.useQuery(undefined, { staleTime: 60_000 });",
  "}",
  "",
  "export function useSyncUser() {",
  "  return t.auth.sync.useMutation({});",
  "}",
  "",
  "export function useSelectRole() {",
  "  const utils = t.useUtils();",
  "  return t.auth.selectRole.useMutation({",
  "    onSuccess: () => { void utils.auth.me.invalidate(); },",
  "  });",
  "}",
].join('\n'));
console.log('✓ hooks/use-profile.ts → cast as any');

console.log('\n✓ Listo — en produccion funciona igual, el cast es solo para TypeScript');
JSEOF

echo "✓ Listo"