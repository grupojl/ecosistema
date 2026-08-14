import type { PaginationMeta } from '@/types/api';

export type Canal = 'whatsapp' | 'instagram' | 'telegram' | 'web';
export type EtapaCliente = 'prospecto' | 'oportunidad' | 'post_venta' | 'recompra' | 'inactivo';

export interface Cliente {
  id: string;
  nombre: string;
  canal: Canal;
  etapa: EtapaCliente;
  avatar?: string;
  telefono?: string;
  ultimaInteraccion: string;
  preferencias: string[];
  historialCompras: { producto: string; fecha: string; monto: number }[];
  organizacionId?: string;
}

export interface Mensaje {
  id: string;
  clienteId: string;
  conversacionId: string;
  contenido: string;
  origen: 'cliente' | 'agente' | 'bot';
  timestamp: string;
  leido: boolean;
}

export interface Conversacion {
  id: string;
  cliente: Cliente;
  ultimoMensaje?: Mensaje;
  noLeidos: number;
  oportunidadDetectada: boolean;
  updatedAt: string;
}

export interface PaginatedConversaciones {
  items: Conversacion[];
  meta: PaginationMeta;
}

export interface PaginatedMensajes {
  items: Mensaje[];
  meta: PaginationMeta;
}

export interface ConversacionFilters {
  canal?: Canal;
  etapa?: EtapaCliente;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EnviarMensajeInput {
  conversacionId: string;
  contenido: string;
}

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
