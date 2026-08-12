// realsass-dashboard-front/features/chat/hooks/use-proyectos-ia.ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  createProyectoIA,
  getAssistantConfig,
  getProyectosIA,
  toggleAssistant,
  updateAssistantConfig,
} from '../services/chat.service';
import type { CreateProyectoInput, UpdateAssistantConfigInput } from '../types';

function useOrgId(): string {
  const { profile } = useAuth();
  return profile?.tenants?.[0]?.organizationId ?? '';
}

export function useProyectosIA() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: ['chat-proyectos', orgId],
    queryFn:  () => getProyectosIA(orgId).then((r) => r.data),
    enabled:  Boolean(orgId),
  });
}

export function useCrearProyectoIA() {
  const orgId = useOrgId();
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProyectoInput) => createProyectoIA(orgId, input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['chat-proyectos', orgId] }),
  });
}

export function useAssistantConfig(slug: string) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: ['chat-assistant-config', orgId, slug],
    queryFn:  () => getAssistantConfig(orgId, slug).then((r) => r.data),
    enabled:  Boolean(orgId) && Boolean(slug),
  });
}

export function useUpdateAssistantConfig(slug: string) {
  const orgId = useOrgId();
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAssistantConfigInput) =>
      updateAssistantConfig(orgId, slug, input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['chat-assistant-config', orgId, slug] }),
  });
}

export function useToggleAssistant(slug: string) {
  const orgId = useOrgId();
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: () => toggleAssistant(orgId, slug),
    onSuccess:  () =>
      qc.invalidateQueries({ queryKey: ['chat-assistant-config', orgId, slug] }),
  });
}
