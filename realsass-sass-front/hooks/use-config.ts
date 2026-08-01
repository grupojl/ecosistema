/**
 * hooks/use-config.ts
 *
 * Hooks de configuracion para realsass-sass-front.
 * Usa TanStack Query + REST (lib/config-api.ts).
 * El cliente tRPC del sass-front se usa solo para auth y organizations.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFeatureFlags, updateFeatureFlag,
  getQuotas, updateQuotaLimit,
  getThemes, activateTheme,
  getTemplates,
  getWebhooks,
} from '@/lib/config-api';

// ── Feature Flags ─────────────────────────────────────────────────────────

export function useFeatureFlags(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['config-flags', organizationId],
    queryFn:  () => getFeatureFlags(organizationId!),
    enabled:  !!organizationId,
    staleTime: 30_000,
  });
}

export function useUpdateFeatureFlag(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      updateFeatureFlag(organizationId!, key, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config-flags', organizationId] }),
  });
}

// ── Quotas ────────────────────────────────────────────────────────────────

export function useQuotas(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['config-quotas', organizationId],
    queryFn:  () => getQuotas(organizationId!),
    enabled:  !!organizationId,
    staleTime: 30_000,
  });
}

export function useUpdateQuotaLimit(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ resource, limit }: { resource: string; limit: number }) =>
      updateQuotaLimit(organizationId!, resource, limit),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config-quotas', organizationId] }),
  });
}

// ── Themes ────────────────────────────────────────────────────────────────

export function useThemes(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['config-themes', organizationId],
    queryFn:  () => getThemes(organizationId!),
    enabled:  !!organizationId,
  });
}

export function useActivateTheme(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (themeId: string) => activateTheme(organizationId!, themeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config-themes', organizationId] }),
  });
}

// ── Templates ─────────────────────────────────────────────────────────────

export function useTemplates(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['config-templates', organizationId],
    queryFn:  () => getTemplates(organizationId!),
    enabled:  !!organizationId,
  });
}

// ── Webhooks ──────────────────────────────────────────────────────────────

export function useWebhooks(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['config-webhooks', organizationId],
    queryFn:  () => getWebhooks(organizationId!),
    enabled:  !!organizationId,
  });
}