// realsass-dashboard-front/features/chat/hooks/use-conversaciones.ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  enviarMensaje,
  getConversaciones,
  getMensajes,
  marcarLeidos,
} from '../services/chat.service';
import type { ConversacionFilters, EnviarMensajeInput } from '../types';

function useOrgId(): string {
  const { profile } = useAuth();
  return profile?.tenants?.[0]?.organizationId ?? '';
}

export function useConversaciones(filters: ConversacionFilters = {}) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: ['chat-conversaciones', orgId, filters],
    queryFn:  () => getConversaciones(orgId, filters),
    enabled:  Boolean(orgId),
  });
}

export function useMensajes(conversacionId: string, page = 1) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: ['chat-mensajes', orgId, conversacionId, page],
    queryFn:  () => getMensajes(orgId, conversacionId, page),
    enabled:  Boolean(orgId) && Boolean(conversacionId),
  });
}

export function useEnviarMensaje() {
  const orgId = useOrgId();
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: (input: EnviarMensajeInput) => enviarMensaje(orgId, input),
    onSuccess:  (_, vars) => {
      void qc.invalidateQueries({
        queryKey: ['chat-mensajes', orgId, vars.conversacionId],
      });
      void qc.invalidateQueries({ queryKey: ['chat-conversaciones', orgId] });
    },
  });
}

export function useMarcarLeidos() {
  const orgId = useOrgId();
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: (conversacionId: string) => marcarLeidos(orgId, conversacionId),
    onSuccess:  () =>
      qc.invalidateQueries({ queryKey: ['chat-conversaciones', orgId] }),
  });
}
