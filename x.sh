#!/usr/bin/env bash
echo "=== Fix: eliminar dependencia de DTOs en services del backend ==="

node - << 'JSEOF'
const fs = require('fs');

// ── 1. collaborators.service.ts — reemplazar DTOs por interfaces puras ────────
let src = fs.readFileSync('realsass-sass-back/src/collaborators/collaborators.service.ts', 'utf8');

// Reemplazar imports de DTOs
src = src.replace(
  "import { InviteCollaboratorDto } from './dto/invite-collaborator.dto';\nimport { UpdateCollaboratorDto } from './dto/update-collaborator.dto';",
  [
    "// Interfaces puras — sin class-validator, compatibles con Next.js type-check",
    "interface InviteCollaboratorDto {",
    "  email: string;",
    "  canViewListings?: boolean;",
    "  canCreateListings?: boolean;",
    "  canEditListings?: boolean;",
    "  canDeleteListings?: boolean;",
    "  canViewStats?: boolean;",
    "  canManageLeads?: boolean;",
    "  canManageCollaborators?: boolean;",
    "}",
    "interface UpdateCollaboratorDto {",
    "  canViewListings?: boolean;",
    "  canCreateListings?: boolean;",
    "  canEditListings?: boolean;",
    "  canDeleteListings?: boolean;",
    "  canViewStats?: boolean;",
    "  canManageLeads?: boolean;",
    "  canManageCollaborators?: boolean;",
    "}",
  ].join('\n')
);
fs.writeFileSync('realsass-sass-back/src/collaborators/collaborators.service.ts', src);
console.log('✓ collaborators.service.ts — DTOs reemplazados por interfaces puras');

// ── 2. Revisar otros services que puedan importar DTOs ────────────────────────
const servicesToCheck = [
  'realsass-sass-back/src/config-flags/config-flags.service.ts',
  'realsass-sass-back/src/config-quotas/config-quotas.service.ts',
  'realsass-sass-back/src/config-themes/config-themes.service.ts',
  'realsass-sass-back/src/config-webhooks/config-webhooks.service.ts',
  'realsass-sass-back/src/config-secrets/config-secrets.service.ts',
  'realsass-sass-back/src/config-templates/config-templates.service.ts',
  'realsass-sass-back/src/config-audit/config-audit.service.ts',
  'realsass-sass-back/src/users/users.service.ts',
  'realsass-sass-back/src/auth/auth.service.ts',
  'realsass-sass-back/src/organizations/organizations.service.ts',
];

for (const path of servicesToCheck) {
  if (!fs.existsSync(path)) continue;
  const content = fs.readFileSync(path, 'utf8');
  const dtoImports = content.match(/import \{[^}]+\} from '\.\/dto\//g);
  if (dtoImports) {
    console.log('⚠ tiene imports de DTO:', path);
    console.log('  ', dtoImports.join('\n  '));
  }
}

// ── 3. packages/trpc/src/index.ts — restaurar AppRouter real ─────────────────
fs.writeFileSync('packages/trpc/src/index.ts', [
  "// @real/trpc — contratos tRPC del ecosistema",
  "export type { TRPCContext }     from './server/context';",
  "export { createContext }        from './server/context';",
  "export {",
  "  createTRPCRouter,",
  "  publicProcedure,",
  "  protectedProcedure,",
  "} from './server/trpc';",
  "",
  "// AppRouter — tipo real del router, sin DTOs NestJS en la cadena.",
  "export type { AppRouter } from '../../../realsass-sass-back/src/trpc/app-router';",
].join('\n'));
console.log('✓ packages/trpc/src/index.ts — AppRouter real restaurado');

// ── 4. router-type.ts de ambos frontends ─────────────────────────────────────
fs.writeFileSync(
  'realsass-sass-front/lib/trpc/router-type.ts',
  "import type { AppRouter } from '@real/trpc';\nexport type { AppRouter };\n"
);
fs.writeFileSync(
  'realsass-dashboard-front/lib/trpc/router-type.ts',
  "import type { AppRouter } from '@real/trpc';\nexport type { AppRouter };\n"
);
console.log('✓ router-type.ts actualizados a @real/trpc');

// ── 5. Restaurar hooks/use-organization.ts del sass-front a tRPC ──────────────
fs.writeFileSync('realsass-sass-front/hooks/use-organization.ts', [
  "import { trpc } from '@/lib/trpc/client';",
  "",
  "export function useMyOrganization() {",
  "  return trpc.organizations.me.useQuery(undefined, {",
  "    staleTime: 60_000,",
  "  });",
  "}",
  "",
  "export function useUpdateOrganization() {",
  "  const utils = trpc.useUtils();",
  "  return trpc.organizations.update.useMutation({",
  "    onSuccess: () => {",
  "      void utils.organizations.me.invalidate();",
  "      void utils.auth.me.invalidate();",
  "    },",
  "  });",
  "}",
].join('\n'));
console.log('✓ sass-front/hooks/use-organization.ts → tRPC restaurado');

// ── 6. Restaurar hooks/use-profile.ts del sass-front a tRPC ──────────────────
fs.writeFileSync('realsass-sass-front/hooks/use-profile.ts', [
  "import { trpc } from '@/lib/trpc/client';",
  "",
  "export function useProfile() {",
  "  return trpc.auth.me.useQuery(undefined, {",
  "    staleTime: 60_000,",
  "  });",
  "}",
  "",
  "export function useSyncUser() {",
  "  return trpc.auth.sync.useMutation({});",
  "}",
  "",
  "export function useSelectRole() {",
  "  const utils = trpc.useUtils();",
  "  return trpc.auth.selectRole.useMutation({",
  "    onSuccess: () => { void utils.auth.me.invalidate(); },",
  "  });",
  "}",
].join('\n'));
console.log('✓ sass-front/hooks/use-profile.ts → tRPC restaurado');

// ── 7. Restaurar hooks/use-config.ts del sass-front a tRPC ───────────────────
fs.writeFileSync('realsass-sass-front/hooks/use-config.ts', [
  "import { trpc } from '@/lib/trpc/client';",
  "",
  "// ── Feature Flags ─────────────────────────────────────────────────────────",
  "export function useFeatureFlags() {",
  "  return trpc.configFlags.list.useQuery(undefined, {",
  "    staleTime: 30_000, refetchInterval: 60_000,",
  "  });",
  "}",
  "export function useUpdateFeatureFlag() {",
  "  const utils = trpc.useUtils();",
  "  return trpc.configFlags.update.useMutation({",
  "    onSettled: () => { void utils.configFlags.list.invalidate(); },",
  "  });",
  "}",
  "",
  "// ── Quotas ────────────────────────────────────────────────────────────────",
  "export function useQuotas() {",
  "  return trpc.configQuotas.list.useQuery(undefined, {",
  "    staleTime: 30_000, refetchInterval: 30_000,",
  "  });",
  "}",
  "export function useUpdateQuotaLimit() {",
  "  const utils = trpc.useUtils();",
  "  return trpc.configQuotas.updateLimit.useMutation({",
  "    onSuccess: () => { void utils.configQuotas.list.invalidate(); },",
  "  });",
  "}",
  "",
  "// ── Themes ────────────────────────────────────────────────────────────────",
  "export function useThemes() {",
  "  return trpc.configThemes.list.useQuery(undefined);",
  "}",
  "export function useActivateTheme() {",
  "  const utils = trpc.useUtils();",
  "  return trpc.configThemes.activate.useMutation({",
  "    onSuccess: () => { void utils.configThemes.list.invalidate(); },",
  "  });",
  "}",
  "",
  "// ── Webhooks ──────────────────────────────────────────────────────────────",
  "export function useWebhooks() {",
  "  return trpc.configWebhooks.list.useQuery(undefined);",
  "}",
  "export function useCreateWebhook() {",
  "  const utils = trpc.useUtils();",
  "  return trpc.configWebhooks.create.useMutation({",
  "    onSuccess: () => { void utils.configWebhooks.list.invalidate(); },",
  "  });",
  "}",
  "export function useDeleteWebhook() {",
  "  const utils = trpc.useUtils();",
  "  return trpc.configWebhooks.remove.useMutation({",
  "    onSuccess: () => { void utils.configWebhooks.list.invalidate(); },",
  "  });",
  "}",
  "export function useWebhookLogs(webhookId: string | null | undefined) {",
  "  return trpc.configWebhooks.getLogs.useQuery(",
  "    { webhookId: webhookId!, take: 50 },",
  "    { enabled: !!webhookId },",
  "  );",
  "}",
].join('\n'));
console.log('✓ sass-front/hooks/use-config.ts → tRPC restaurado');

console.log('\n✓ Fix completo aplicado');
JSEOF

echo "✓ Listo"