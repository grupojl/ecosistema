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
