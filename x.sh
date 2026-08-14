#!/usr/bin/env bash
# =============================================================================
# x.sh — Crear features/chat/hooks.ts en realsass-dashboard-front
# USO (desde raíz del monorepo welver/):
#   bash x.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# Usar pwd en lugar de BASH_SOURCE para evitar el bug de path en Windows
DASH="$(pwd)/realsass-dashboard-front"
[[ -d "$DASH" ]] || { echo "No encontré realsass-dashboard-front en $(pwd)"; exit 1; }

mkdir -p "$DASH/features/chat"

section "features/chat/hooks.ts"

cat > "$DASH/features/chat/hooks.ts" << 'EOF'
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
EOF
ok "features/chat/hooks.ts creado"

section "features/chat/types.ts — agregar tipos de chat-ia"

TYPES="$DASH/features/chat/types.ts"

if grep -q 'ProyectoIA' "$TYPES" 2>/dev/null; then
  echo "[→] tipos chat-ia ya existen — sin cambios"
else
  cat >> "$TYPES" << 'EOF'

// ─── Tipos de chat-ia-back ────────────────────────────────────────────────────

export interface ProyectoIA {
  id:             string;
  organizationId: string;
  slug:           string;
  name:           string;
  description?:   string;
  isActive:       boolean;
  createdAt:      string;
  updatedAt:      string;
}

export interface ConversacionIA {
  id:               string;
  organizationId:   string;
  channelType:      string;
  status:           string;
  assignedAgentId?: string;
  createdAt:        string;
  updatedAt:        string;
  contact?: {
    id:        string;
    name?:     string;
    phone?:    string;
    username?: string;
  };
  lastMessage?: {
    content:   string;
    direction: string;
    createdAt: string;
  };
}

export type ConversacionStatus = 'OPEN' | 'CLOSED' | 'PENDING' | 'RESOLVED';

export interface MensajeIA {
  id:        string;
  content:   string;
  direction: 'INBOUND' | 'OUTBOUND';
  type:      string;
  status:    string;
  createdAt: string;
}

export interface ChatResponse {
  sessionId:       string;
  response:        string;
  tokensUsed:      number;
  modelUsed:       string;
  usedFaqFallback: boolean;
}
EOF
  ok "tipos chat-ia agregados"
fi

section "Resumen"
echo ""
echo "  Archivos:"
echo "    + realsass-dashboard-front/features/chat/hooks.ts"
echo "    ~ realsass-dashboard-front/features/chat/types.ts"
echo ""
echo "  Próximos pasos:"
echo "    git add ."
echo "    git commit -m 'feat: hooks TanStack Query para chat-ia-back'"
echo "    git push origin main"
echo ""
echo "  Luego navegar a:"
echo "    /dashboard/chat/proyectos  → lista proyectos de chat-ia"
echo "    /dashboard/chat            → lista conversaciones"
echo ""