// features/chat/hooks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatIaFetch } from '@/lib/chat-ia-client';
import { useAuth } from '@/features/auth/hooks/use-auth';
import type { ProyectoIA, ConversacionIA, MensajeIA, ChatResponse } from '@/features/chat/types';

type ConversacionBack = Omit<ConversacionIA, 'channelType' | 'lastMessage'> & {
  contact?:  ConversacionIA['contact'] & { channelType?: string };
  messages?: ConversacionIA['lastMessage'][];
};

export function useProyectosIA() {
  const orgId = useAuth().organizationId ?? '';
  return useQuery({
    queryKey: ['chat-ia', 'projects', orgId],
    queryFn: () =>
      chatIaFetch<{ success: boolean; data: ProyectoIA[] }>('/projects', orgId)
        .then(r => r.data),
    enabled: !!orgId,
  });
}

export function useCrearProyectoIA() {
  const orgId = useAuth().organizationId ?? '';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; slug?: string; description?: string }) =>
      chatIaFetch<{ success: boolean; data: ProyectoIA }>(
        '/projects', orgId,
        { method: 'POST', body: JSON.stringify(dto) },
      ).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-ia', 'projects', orgId] }),
  });
}

export function useConversaciones(_params?: { canal?: string; etapa?: string; limit?: number }) {
  const orgId = useAuth().organizationId ?? '';
  return useQuery({
    queryKey: ['chat-ia', 'conversations', orgId],
    // El back devuelve { data, total, page, pages }; cada item trae `contact`
    // (con su channelType) y `messages` (último mensaje, take: 1).
    queryFn: () =>
      chatIaFetch<{ data: ConversacionBack[] }>('/conversations', orgId)
        .then(r => r.data.map(({ messages, ...c }): ConversacionIA => ({
          ...c,
          channelType: c.contact?.channelType ?? '',
          lastMessage: messages?.[0],
        }))),
    enabled: !!orgId,
  });
}

export function useMensajes(conversacionId: string) {
  const orgId = useAuth().organizationId ?? '';
  return useQuery({
    queryKey: ['chat-ia', 'messages', orgId, conversacionId],
    queryFn: () =>
      chatIaFetch<{ success: boolean; data: MensajeIA[] }>(
        `/conversations/${conversacionId}/messages`, orgId,
      ).then(r => r.data),
    enabled: !!orgId && !!conversacionId,
  });
}

/** Sin projectSlug el back usa el proyecto por defecto de la organización. */
export function useEnviarMensajeAsistente(projectSlug?: string) {
  const orgId = useAuth().organizationId ?? '';
  return useMutation({
    mutationFn: (dto: { userId: string; message: string; channel?: string }) =>
      chatIaFetch<ChatResponse>(
        '/assistant/chat', orgId,
        { method: 'POST', body: JSON.stringify({ ...dto, projectSlug }) },
      ),
  });
}
