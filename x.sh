#!/usr/bin/env bash
# =============================================================================
# x.sh — Integración realsass-dashboard-front ↔ chat-ia-back
# Repo: grupojl/ecosistema (raíz del monorepo welver/)
#
# Qué hace:
#   1. Agrega NEXT_PUBLIC_CHAT_IA_URL al .env.example del dashboard-front
#   2. Crea lib/chat-ia-client.ts  — fetch autenticado al chat-ia-back
#   3. Crea features/chat/types/index.ts — tipos alineados al schema del back
#   4. Crea features/chat/services/chat.service.ts — endpoints reales
#   5. Crea features/chat/hooks/use-proyectos-ia.ts — CRUD proyectos IA
#   6. Crea features/chat/hooks/use-conversaciones.ts — conversaciones
#   7. Actualiza features/chat/hooks/index.ts — exportaciones
#   8. Reemplaza app/dashboard/chat/page.tsx — lista de conversaciones real
#   9. Crea app/dashboard/chat/proyectos/page.tsx — gestión proyectos IA
#
# USO (desde raíz del monorepo welver/):
#   bash x.sh
#   bash x.sh --dry-run
# =============================================================================
set -euo pipefail

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log()     { echo -e "${BLUE}[→]${NC} $1"; }
ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
err()     { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${CYAN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASH="$ROOT/realsass-dashboard-front"

[[ -f "$ROOT/pnpm-workspace.yaml" ]]             || err "Ejecutá desde la raíz del monorepo (welver/)"
[[ -d "$DASH/app/dashboard/chat" ]]              || err "No encontré realsass-dashboard-front/app/dashboard/chat"
[[ -f "$DASH/lib/api-client.ts" ]]               || err "No encontré lib/api-client.ts en dashboard-front"

[[ "$DRY_RUN" == true ]] && warn "DRY-RUN — no se escribirá nada"

write_file() {
  local rel="$1"; local full="$ROOT/$rel"
  mkdir -p "$(dirname "$full")"
  if [[ "$DRY_RUN" == true ]]; then warn "[DRY] write → $rel"; return; fi
  [[ -f "$full" ]] && cp "$full" "${full}.bak" && log "backup → ${rel}.bak"
  cat > "$full"
  ok "write → $rel"
}

sed_inplace() {
  local expr="$1"; local file="$2"
  sed -i.sedbak "$expr" "$file" 2>/dev/null || sed -i "$expr" "$file"
  rm -f "${file}.sedbak"
}

# =============================================================================
# 1 — .env.example: agregar NEXT_PUBLIC_CHAT_IA_URL
# =============================================================================
section "1/9 — .env.example"

ENV_EXAMPLE="$DASH/.env.example"

if [[ -f "$ENV_EXAMPLE" ]]; then
  if ! grep -q 'CHAT_IA_URL' "$ENV_EXAMPLE"; then
    if [[ "$DRY_RUN" == false ]]; then
      cat >> "$ENV_EXAMPLE" << 'ENVEOF'

# ── Chat IA back ──────────────────────────────────────────────────────────────
# URL del chat-ia-back en Railway
NEXT_PUBLIC_CHAT_IA_URL=https://tu-chat-ia-back.railway.app
ENVEOF
      ok "NEXT_PUBLIC_CHAT_IA_URL agregada a .env.example"
    else
      warn "[DRY] append → .env.example"
    fi
  else
    log "CHAT_IA_URL ya existe en .env.example"
  fi
else
  warn ".env.example no encontrado en dashboard-front — crear manualmente"
fi

# =============================================================================
# 2 — lib/chat-ia-client.ts (cliente fetch para chat-ia-back)
# =============================================================================
section "2/9 — lib/chat-ia-client.ts"

write_file "realsass-dashboard-front/lib/chat-ia-client.ts" << 'EOF'
// realsass-dashboard-front/lib/chat-ia-client.ts
//
// Cliente HTTP autenticado para chat-ia-back.
// Incluye el Firebase Bearer token + x-organization-id en cada request.
// La URL base viene de NEXT_PUBLIC_CHAT_IA_URL.
import { getIdToken } from '@real/auth-client';

const CHAT_IA_URL = process.env['NEXT_PUBLIC_CHAT_IA_URL'] ?? '';

export function buildQuery(params: Record<string, unknown>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

async function getHeaders(organizationId: string): Promise<Record<string, string>> {
  const token = await getIdToken();
  return {
    'Content-Type':      'application/json',
    'Authorization':     `Bearer ${token}`,
    'x-organization-id': organizationId,
  };
}

export async function chatIaFetch<T>(
  path:           string,
  organizationId: string,
  options:        RequestInit = {},
): Promise<T> {
  const headers = await getHeaders(organizationId);

  const res = await fetch(`${CHAT_IA_URL}/api/v1${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status} — ${path}`);
  }

  return res.json() as Promise<T>;
}
EOF

# =============================================================================
# 3 — features/chat/types/index.ts
# =============================================================================
section "3/9 — features/chat/types/index.ts"

write_file "realsass-dashboard-front/features/chat/types/index.ts" << 'EOF'
// realsass-dashboard-front/features/chat/types/index.ts
// Tipos alineados al schema de chat-ia-back (ADR-001)

// ── Proyectos IA ──────────────────────────────────────────────────────────────
export interface ProyectoIA {
  id:          string;
  slug:        string;
  name:        string;
  description: string | null;
  isActive:    boolean;
  createdAt:   string;
  updatedAt:   string;
}

export interface CreateProyectoInput {
  name:        string;
  slug:        string;
  description?: string;
}

// ── Configuración del Asistente ───────────────────────────────────────────────
export interface AssistantConfig {
  id:                 string;
  personaName:        string;
  systemPrompt:       string;
  welcomeMessage:     string | null;
  isEnabled:          boolean;
  groqModel:          string;
  temperature:        number;
  maxTokens:          number;
  sessionTtlMinutes:  number;
}

export interface UpdateAssistantConfigInput {
  personaName?:       string;
  systemPrompt?:      string;
  welcomeMessage?:    string;
  groqModel?:         string;
  temperature?:       number;
  maxTokens?:         number;
  sessionTtlMinutes?: number;
}

// ── Conversaciones ────────────────────────────────────────────────────────────
export type ConversacionStatus =
  | 'OPEN'
  | 'RESOLVED'
  | 'PENDING'
  | 'HUMAN_TAKEOVER';

export type ChannelType =
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'MESSENGER'
  | 'TIKTOK'
  | 'widget';

export interface Conversacion {
  id:               string;
  organizationId:   string;
  status:           ConversacionStatus;
  channelType:      ChannelType;
  contactName:      string | null;
  lastMessageAt:    string | null;
  unreadCount:      number;
  assignedAgentId:  string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface ConversacionFilters {
  status?:      ConversacionStatus;
  channelType?: ChannelType;
  page?:        number;
  limit?:       number;
}

export interface PaginatedConversaciones {
  data:  Conversacion[];
  total: number;
  page:  number;
  limit: number;
}

// ── Mensajes ──────────────────────────────────────────────────────────────────
export type MensajeRole = 'user' | 'assistant' | 'agent';

export interface Mensaje {
  id:             string;
  conversationId: string;
  role:           MensajeRole;
  content:        string;
  isRead:         boolean;
  createdAt:      string;
}

export interface PaginatedMensajes {
  data:  Mensaje[];
  total: number;
  page:  number;
  limit: number;
}

export interface EnviarMensajeInput {
  conversacionId: string;
  contenido:      string;
}
EOF

# =============================================================================
# 4 — features/chat/services/chat.service.ts
# =============================================================================
section "4/9 — features/chat/services/chat.service.ts"

write_file "realsass-dashboard-front/features/chat/services/chat.service.ts" << 'EOF'
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
EOF

# =============================================================================
# 5 — features/chat/hooks/use-proyectos-ia.ts
# =============================================================================
section "5/9 — features/chat/hooks/use-proyectos-ia.ts"

write_file "realsass-dashboard-front/features/chat/hooks/use-proyectos-ia.ts" << 'EOF'
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
EOF

# =============================================================================
# 6 — features/chat/hooks/use-conversaciones.ts
# =============================================================================
section "6/9 — features/chat/hooks/use-conversaciones.ts"

write_file "realsass-dashboard-front/features/chat/hooks/use-conversaciones.ts" << 'EOF'
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
EOF

# =============================================================================
# 7 — features/chat/hooks/index.ts
# =============================================================================
section "7/9 — features/chat/hooks/index.ts"

write_file "realsass-dashboard-front/features/chat/hooks/index.ts" << 'EOF'
export {
  useConversaciones,
  useMensajes,
  useEnviarMensaje,
  useMarcarLeidos,
} from './use-conversaciones';

export {
  useProyectosIA,
  useCrearProyectoIA,
  useAssistantConfig,
  useUpdateAssistantConfig,
  useToggleAssistant,
} from './use-proyectos-ia';
EOF

# =============================================================================
# 8 — app/dashboard/chat/page.tsx (reemplazar placeholder)
# =============================================================================
section "8/9 — app/dashboard/chat/page.tsx"

write_file "realsass-dashboard-front/app/dashboard/chat/page.tsx" << 'EOF'
'use client';
// app/dashboard/chat/page.tsx — lista de conversaciones del chat-ia-back
import Link from 'next/link';
import { MessageSquare, Bot, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConversaciones } from '@/features/chat/hooks';
import type { ConversacionStatus } from '@/features/chat/types';

const STATUS_LABEL: Record<ConversacionStatus, string> = {
  OPEN:           'Abierta',
  PENDING:        'Pendiente',
  HUMAN_TAKEOVER: 'Requiere agente',
  RESOLVED:       'Resuelta',
};

const STATUS_VARIANT: Record<
  ConversacionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  OPEN:           'default',
  PENDING:        'secondary',
  HUMAN_TAKEOVER: 'destructive',
  RESOLVED:       'outline',
};

export default function ChatIAPage() {
  const { data, isLoading, refetch, isRefetching } = useConversaciones({ limit: 50 });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chat IA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conversaciones activas de todos los canales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Link href="/dashboard/chat/proyectos">
            <Button variant="outline" size="sm">
              <Bot className="mr-2 h-4 w-4" />
              Proyectos IA
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Cargando conversaciones...
        </div>
      )}

      {/* Empty */}
      {!isLoading && !data?.data?.length && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <MessageSquare className="h-12 w-12 opacity-30" />
          <p className="font-medium">Sin conversaciones activas</p>
          <p className="text-sm">
            Las conversaciones de tus canales aparecerán acá.
          </p>
        </div>
      )}

      {/* Lista */}
      {data?.data && data.data.length > 0 && (
        <div className="divide-y rounded-lg border bg-card">
          {data.data.map((conv) => (
            <div
              key={conv.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-medium truncate">
                  {conv.contactName ?? 'Contacto desconocido'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {conv.channelType}
                  {conv.lastMessageAt && (
                    <> · {new Date(conv.lastMessageAt).toLocaleString('es-AR')}</>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {conv.unreadCount > 0 && (
                  <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                    {conv.unreadCount}
                  </span>
                )}
                <Badge variant={STATUS_VARIANT[conv.status]}>
                  {STATUS_LABEL[conv.status]}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {data?.total != null && (
        <p className="text-xs text-muted-foreground text-right">
          {data.total} conversación{data.total !== 1 ? 'es' : ''} en total
        </p>
      )}
    </div>
  );
}
EOF

# =============================================================================
# 9 — app/dashboard/chat/proyectos/page.tsx (nueva página)
# =============================================================================
section "9/9 — app/dashboard/chat/proyectos/page.tsx"

write_file "realsass-dashboard-front/app/dashboard/chat/proyectos/page.tsx" << 'EOF'
'use client';
// app/dashboard/chat/proyectos/page.tsx — gestión de proyectos IA
import Link from 'next/link';
import { Bot, ArrowLeft, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProyectosIA } from '@/features/chat/hooks';

export default function ProyectosIAPage() {
  const { data: proyectos, isLoading, refetch } = useProyectosIA();

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/chat">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Proyectos IA</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configuración de asistentes por canal
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Cargando proyectos...
        </div>
      )}

      {/* Empty */}
      {!isLoading && !proyectos?.length && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Bot className="h-12 w-12 opacity-30" />
          <p className="font-medium">Sin proyectos IA</p>
          <p className="text-sm">
            Creá un proyecto en el chat-ia-back para empezar.
          </p>
        </div>
      )}

      {/* Lista */}
      {proyectos && proyectos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((proyecto) => (
            <div
              key={proyecto.id}
              className="rounded-lg border bg-card p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-medium truncate">{proyecto.name}</span>
                </div>
                {proyecto.isActive ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>

              {proyecto.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {proyecto.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-auto pt-2">
                <Badge variant="outline" className="text-xs font-mono">
                  {proyecto.slug}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(proyecto.createdAt).toLocaleDateString('es-AR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
EOF

# =============================================================================
section "Integración completada"

echo ""
echo "  Archivos creados/modificados:"
echo "    ~ realsass-dashboard-front/.env.example         (NEXT_PUBLIC_CHAT_IA_URL)"
echo "    + realsass-dashboard-front/lib/chat-ia-client.ts"
echo "    + realsass-dashboard-front/features/chat/types/index.ts"
echo "    + realsass-dashboard-front/features/chat/services/chat.service.ts"
echo "    + realsass-dashboard-front/features/chat/hooks/use-proyectos-ia.ts"
echo "    + realsass-dashboard-front/features/chat/hooks/use-conversaciones.ts"
echo "    ~ realsass-dashboard-front/features/chat/hooks/index.ts"
echo "    ~ realsass-dashboard-front/app/dashboard/chat/page.tsx"
echo "    + realsass-dashboard-front/app/dashboard/chat/proyectos/page.tsx"
echo ""
echo "  Próximos pasos:"
echo ""
echo "  1. Agregar NEXT_PUBLIC_CHAT_IA_URL en Railway → dashboard-front"
echo "     Valor: URL del chat-ia-back en Railway"
echo ""
echo "  2. Registrar ecosistema Welver en chat-ia-back (si no está):"
echo "     POST {CHAT_IA_URL}/api/v1/ecosystems"
echo "     Header: x-platform-admin-key: {PLATFORM_ADMIN_KEY}"
echo "     Body: { firebaseProjectId: 'real-sass', name: 'Welver' }"
echo ""
echo "  3. git add . && git commit -m 'feat: integrar dashboard-front con chat-ia-back'"
echo ""
echo "  4. Railway redeploya dashboard-front automáticamente"