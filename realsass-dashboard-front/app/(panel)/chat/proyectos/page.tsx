'use client';
// app/(panel)/chat/proyectos/page.tsx — gestión de proyectos IA
import Link from 'next/link';
import { Bot, ArrowLeft, RefreshCw, CheckCircle, CircleX } from 'lucide-react';
import { Badge, LoadingState, PageContainer, PageHeader, Card } from '@real/ui';
import { Button } from '@real/ui';
import { useProyectosIA } from '@/features/chat/hooks';

export default function ProyectosIAPage() {
  const { data: proyectos, isLoading, refetch } = useProyectosIA();

  return (
    <PageContainer size="xl">
      <PageHeader
        title="Proyectos IA"
        description="Configuración de asistentes por canal"
        breadcrumb={[{ label: 'Chat IA', href: '/chat' }, { label: 'Proyectos IA' }]}
        breadcrumbLinkAs={Link}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        }
      />

      {/* Loading */}
      {isLoading && <LoadingState label="Cargando proyectos…" />}

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
            <Card
              key={proyecto.id}
              className="bg-card p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-medium truncate">{proyecto.name}</span>
                </div>
                {proyecto.isActive ? (
                  <CheckCircle className="h-4 w-4 text-success-ink shrink-0" />
                ) : (
                  <CircleX className="h-4 w-4 text-muted-foreground shrink-0" />
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
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
