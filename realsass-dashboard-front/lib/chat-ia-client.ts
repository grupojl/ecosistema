// realsass-dashboard-front/lib/chat-ia-client.ts
//
// Adaptador HTTP para chat-ia-back.
//
// ESTADO: chat-ia-back todavía no tiene router tRPC (Sprint pendiente).
// Este archivo es el ÚNICO lugar donde vive el fetch manual hacia ese back.
// Cuando chat-ia-back tenga su AppRouter, este archivo se elimina y los
// hooks de features/chat/ pasan a usar el cliente tRPC directamente.
//
// TODO(S-chat): migrar a tRPC cuando chat-ia-back exponga /api/v1/trpc
//   1. Agregar ChatIaAppRouter a @real/trpc
//   2. Reemplazar chatIaFetch por trpc.chat.* en features/chat/hooks.ts
//   3. Eliminar este archivo

import { getIdToken } from '@real/auth-client';
import { AppError }   from '@real/auth-client';

// ─── Config ───────────────────────────────────────────────────────────────────

function getChatIaUrl(): string {
  const url = process.env.NEXT_PUBLIC_CHAT_IA_URL;
  if (!url) throw new AppError('SERVER', '[chat-ia-client] NEXT_PUBLIC_CHAT_IA_URL no definida');
  // chat-ia-back expone todo bajo el prefijo global /api/v1.
  return `${url.replace(/\/+$/, '')}/api/v1`;
}

// ─── Tipos de respuesta de chat-ia-back ──────────────────────────────────────
// Tipado explícito en lugar de `any` — se actualiza cuando el back cambia contrato.

export interface ChatConversacion {
  id:             string;
  organizationId: string;
  projectSlug:    string;
  status:         'open' | 'closed' | 'pending';
  createdAt:      string;
  updatedAt:      string;
}

export interface ChatProyecto {
  id:      string;
  slug:    string;
  name:    string;
  status:  'active' | 'inactive';
  agentId: string | null;
}

export interface ChatMensaje {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  createdAt: string;
}

// ─── Helper: query string ─────────────────────────────────────────────────────

export function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) q.set(k, String(v));
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

// ─── Fetch autenticado ────────────────────────────────────────────────────────

async function getHeaders(organizationId: string, forceRefresh = false): Promise<Record<string, string>> {
  const token = await getIdToken(forceRefresh);
  return {
    'Content-Type':     'application/json',
    'Authorization':    `Bearer ${token ?? ''}`,
    'x-organization-id': organizationId,
  };
}

export async function chatIaFetch<T>(
  path:           string,
  organizationId: string,
  options:        RequestInit = {},
): Promise<T> {
  const url     = `${getChatIaUrl()}${path}`;
  const doFetch = async (forceRefresh: boolean) => {
    const headers = await getHeaders(organizationId, forceRefresh);
    return fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  };

  let res = await doFetch(false);
  // Los custom claims (organizationId, permissions.chat) los emite sass-back en
  // POST /auth/session; un token anterior no los trae hasta refrescarse.
  if (res.status === 401 || res.status === 403) res = await doFetch(true);

  if (!res.ok) {
    let msg = `chat-ia-back error ${res.status}`;
    try { const b = await res.json() as { message?: string }; msg = b.message ?? msg; } catch { /* noop */ }
    throw new AppError(res.status === 401 ? 'AUTH' : 'SERVER', msg);
  }

  return res.json() as Promise<T>;
}