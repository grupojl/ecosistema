'use client';

import { useState, useMemo } from 'react';
import { MessageSquare, SlidersHorizontal, Search, CircleAlert } from 'lucide-react';
import { NativeSelect, Button, Badge, SectionHeader } from '@real/ui';
import { Input } from '@real/ui';
import { ScrollArea } from '@real/ui';
import { Skeleton } from '@real/ui';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/helpers';
import { CanalBadge } from '@/features/chat/components/canal-badge';
import { EtapaBadge, ETAPA_CONFIG } from '@/features/chat/components/etapa-badge';
import type { Canal, Conversacion, EtapaCliente } from '@/features/chat/types';

const CANAL_LABELS: Record<Canal, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', telegram: 'Telegram', web: 'Web',
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function Avatar({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <div className={cn('rounded-full bg-accent flex items-center justify-center flex-shrink-0 font-medium text-foreground', className)}>
      {getInitials(nombre)}
    </div>
  );
}

function ConversacionSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

interface ConversationListProps {
  conversaciones: Conversacion[];
  isLoading?: boolean;
  error?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversaciones, isLoading = false, error = false, selectedId, onSelect }: ConversationListProps) {
  const [search,      setSearch]      = useState('');
  const [filterCanal, setFilterCanal] = useState<Canal | ''>('');
  const [filterEtapa, setFilterEtapa] = useState<EtapaCliente | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  const totalNoLeidos = conversaciones.reduce((acc, c) => acc + (c.noLeidos ?? 0), 0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return conversaciones.filter(
      (c) =>
        (!filterCanal || c.cliente.canal === filterCanal) &&
        (!filterEtapa || c.cliente.etapa === filterEtapa) &&
        (!q ||
          c.cliente.nombre.toLowerCase().includes(q) ||
          c.ultimoMensaje?.contenido.toLowerCase().includes(q)),
    );
  }, [conversaciones, search, filterCanal, filterEtapa]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SectionHeader size="sm" title="Conversaciones" />
            {totalNoLeidos > 0 && (
              <Badge variant="warning" className="h-5 min-w-5 justify-center px-1 text-[10px]">{totalNoLeidos}</Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted border-border"
          />
        </div>

        {showFilters && (
          <div className="space-y-2">
            <NativeSelect
              value={filterCanal}
              onChange={(e) => setFilterCanal(e.target.value as Canal | '')}
            >
              <option value="">Todos los canales</option>
              {(Object.keys(CANAL_LABELS) as Canal[]).map((c) => (
                <option key={c} value={c}>{CANAL_LABELS[c]}</option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={filterEtapa}
              onChange={(e) => setFilterEtapa(e.target.value as EtapaCliente | '')}
            >
              <option value="">Todas las etapas</option>
              {(Object.keys(ETAPA_CONFIG) as EtapaCliente[]).map((e) => (
                <option key={e} value={e}>{ETAPA_CONFIG[e].label}</option>
              ))}
            </NativeSelect>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <>{[1, 2, 3, 4].map((i) => <ConversacionSkeleton key={i} />)}</>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <CircleAlert className="h-8 w-8 text-destructive" />
            <p className="text-xs text-muted-foreground">Error al cargar conversaciones</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Sin conversaciones</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected    = conv.id === selectedId;
            const ultimoMensaje = conv.ultimoMensaje;
            return (
              <Button
                key={conv.id}
                variant="ghost"
                onClick={() => onSelect(conv.id)}
                aria-current={isSelected ? 'true' : undefined}
                className={cn(
                  'h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-none border-b border-border/50 px-4 py-3 text-left font-normal',
                  isSelected && 'bg-muted',
                )}
                >
                <div className="relative flex-shrink-0">
                  <Avatar nombre={conv.cliente.nombre} className="h-10 w-10 text-sm" />
                  {conv.oportunidadDetectada && (
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-warning border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{conv.cliente.nombre}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {conv.noLeidos > 0 && (
                        <span
                          className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-bold bg-warning/20 text-warning-ink"
                        >
                          {conv.noLeidos}
                        </span>
                      )}
                      {ultimoMensaje && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(ultimoMensaje.timestamp)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CanalBadge canal={conv.cliente.canal} />
                    <EtapaBadge etapa={conv.cliente.etapa} />
                  </div>
                  {ultimoMensaje && (
                    <p className="text-xs text-muted-foreground truncate">{ultimoMensaje.contenido}</p>
                  )}
                </div>
              </Button>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
}
