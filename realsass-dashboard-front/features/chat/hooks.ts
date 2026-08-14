// features/chat/hooks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatIaFetch } from '@/lib/chat-ia-client';
import { useAuth } from '@/features/auth/hooks/use-auth';
import type { ProyectoIA, ConversacionIA, MensajeIA, ChatResponse } from './types';

export function useProyectosIA() {
  const { profile } = useAuth();
  const orgId = profile?.organization?.id ?? '';
  return useQuery({
    queryKey: ['chat-ia', 'projects', orgId],
    queryFn: () =>
      chatIaFetch<{ success: boolean; data: ProyectoIA[] }>('/projects', orgId)
        .then(r => r.data),
    enabled: !!orgId,
  });
}

export function useCrearProyectoIA() {
  const { profile } = useAuth();
  const orgId = profile?.organization?.id ?? '';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; description?: string }) =>
      chatIaFetch<{ success: boolean; data: ProyectoIA }>(
        '/projects', orgId,
        { method: 'POST', body: JSON.stringify(dto) },
      ).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-ia', 'projects', orgId] }),
  });
}

export function useConversaciones() {
  const { profile } = useAuth();
  const orgId = profile?.organization?.id ?? '';
  return useQuery({
    queryKey: ['chat-ia', 'conversations', orgId],
    queryFn: () =>
      chatIaFetch<{ success: boolean; data: ConversacionIA[] }>('/conversations', orgId)
        .then(r => r.data),
    enabled: !!orgId,
  });
}

export function useMensajes(conversacionId: string) {
  const { profile } = useAuth();
  const orgId = profile?.organization?.id ?? '';
  return useQuery({
    queryKey: ['chat-ia', 'messages', orgId, conversacionId],
    queryFn: () =>
      chatIaFetch<{ success: boolean; data: MensajeIA[] }>(
        `/conversations/${conversacionId}/messages`, orgId,
      ).then(r => r.data),
    enabled: !!orgId && !!conversacionId,
  });
}

export function useEnviarMensajeAsistente(projectSlug: string) {
  const { profile } = useAuth();
  const orgId = profile?.organization?.id ?? '';
  return useMutation({
    mutationFn: (dto: { userId: string; message: string; channel?: string }) =>
      chatIaFetch<ChatResponse>(
        `/projects/${projectSlug}/assistant/chat`, orgId,
        { method: 'POST', body: JSON.stringify(dto) },
      ),
  });
}
