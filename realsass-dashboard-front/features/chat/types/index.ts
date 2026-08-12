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
