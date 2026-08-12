// realsass-dashboard-front/features/chat/services/chat.service.ts
import { chatIaFetch, buildQuery } from '@/lib/chat-ia-client';
import type {
  AssistantConfig,
  ConversacionFilters,
  CreateProyectoInput,
  EnviarMensajeInput,
  PaginatedConversaciones,
  PaginatedMensajes,
  ProyectoIA,
  UpdateAssistantConfigInput,
} from '../types';

// ── Proyectos IA ──────────────────────────────────────────────────────────────

export const getProyectosIA = (orgId: string) =>
  chatIaFetch<{ data: ProyectoIA[] }>('/projects', orgId);

export const createProyectoIA = (orgId: string, input: CreateProyectoInput) =>
  chatIaFetch<{ data: ProyectoIA }>('/projects', orgId, {
    method: 'POST',
    body:   JSON.stringify(input),
  });

// ── Configuración del Asistente ───────────────────────────────────────────────

export const getAssistantConfig = (orgId: string, slug: string) =>
  chatIaFetch<{ data: AssistantConfig }>(`/projects/${slug}/assistant/config`, orgId);

export const updateAssistantConfig = (
  orgId: string,
  slug:  string,
  input: UpdateAssistantConfigInput,
) =>
  chatIaFetch<{ data: AssistantConfig }>(`/projects/${slug}/assistant/config`, orgId, {
    method: 'PUT',
    body:   JSON.stringify(input),
  });

export const toggleAssistant = (orgId: string, slug: string) =>
  chatIaFetch<{ data: AssistantConfig }>(`/projects/${slug}/assistant/config/toggle`, orgId, {
    method: 'PATCH',
  });

// ── Conversaciones ────────────────────────────────────────────────────────────

export const getConversaciones = (orgId: string, filters: ConversacionFilters = {}) =>
  chatIaFetch<PaginatedConversaciones>(
    `/conversations${buildQuery(filters as Record<string, unknown>)}`,
    orgId,
  );

export const getMensajes = (orgId: string, conversacionId: string, page = 1) =>
  chatIaFetch<PaginatedMensajes>(
    `/conversations/${conversacionId}/messages${buildQuery({ page, limit: 50 })}`,
    orgId,
  );

export const enviarMensaje = (orgId: string, input: EnviarMensajeInput) =>
  chatIaFetch<{ data: Mensaje }>(`/conversations/${input.conversacionId}/messages`, orgId, {
    method: 'POST',
    body:   JSON.stringify({ content: input.contenido }),
  });

export const marcarLeidos = (orgId: string, conversacionId: string) =>
  chatIaFetch<{ updated: number }>(`/conversations/${conversacionId}/read`, orgId, {
    method: 'PATCH',
  });

// Fix de tipo — Mensaje no importado arriba, lo re-exportamos del módulo de tipos
import type { Mensaje } from '../types';
