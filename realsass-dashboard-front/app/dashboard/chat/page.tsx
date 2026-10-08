'use client';
// app/dashboard/chat/page.tsx — lista de conversaciones del chat-ia-back
import Link from 'next/link';
import { MessageSquare, Bot, RefreshCw } from 'lucide-react';
import { Badge } from '@real/ui';
import { Button } from '@real/ui';
import { useConversaciones } from '@/features/chat/hooks';
import type { ConversacionStatus } from '@/features/chat/types';

const STATUS_LABEL: Record<ConversacionStatus, string> = {
  OPEN:           'Abierta',
  PENDING:        'Pendiente',
  HUMAN_TAKEOVER: 'Requiere agente',
  RESOLVED:       'Resuelta',
  CLOSED:         'Cerrada',
};

const STATUS_VARIANT: Record<
  ConversacionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  OPEN:           'default',
  PENDING:        'secondary',
  HUMAN_TAKEOVER: 'destructive',
  RESOLVED:       'outline',
  CLOSED:         'outline',
};

// chat-ia-back devuelve `status` como string libre: se tipa al leer, con fallback.
const statusOf = (status: string): ConversacionStatus | null =>
  status in STATUS_LABEL ? (status as ConversacionStatus) : null;

export default function ChatIAPage() {
  const { data: conversaciones, isLoading, refetch, isRefetching } = useConversaciones({ limit: 50 });

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
      {!isLoading && !conversaciones?.length && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <MessageSquare className="h-12 w-12 opacity-30" />
          <p className="font-medium">Sin conversaciones activas</p>
          <p className="text-sm">
            Las conversaciones de tus canales aparecerán acá.
          </p>
        </div>
      )}

      {/* Lista */}
      {conversaciones && conversaciones.length > 0 && (
        <div className="divide-y rounded-lg border bg-card">
          {conversaciones.map((conv) => {
            const status = statusOf(conv.status);
            const lastAt = conv.lastMessage?.createdAt ?? conv.updatedAt;
            return (
            <div
              key={conv.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-medium truncate">
                  {conv.contact?.name ?? conv.contact?.username ?? conv.contact?.phone ?? 'Contacto desconocido'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {conv.channelType}
                  {lastAt && (
                    <> · {new Date(lastAt).toLocaleString('es-AR')}</>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={status ? STATUS_VARIANT[status] : 'outline'}>
                  {status ? STATUS_LABEL[status] : conv.status}
                </Badge>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Total */}
      {conversaciones && conversaciones.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {conversaciones.length} conversación{conversaciones.length !== 1 ? 'es' : ''} en total
        </p>
      )}
    </div>
  );
}
