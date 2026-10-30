'use client'

import { useEffect, useState } from 'react'
import { Hourglass, Wifi, WifiOff } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, Alert, AlertDescription, AlertTitle, Button, EmptyState, Progress,
} from '@/components/ui'

function Block({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  )
}

/** Banner de conexión que reacciona a los eventos reales online/offline (y a un simulador). */
function ConnectionBanner() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false)
    setOnline(navigator.onLine)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return (
    <div className="space-y-2">
      <div role="status" aria-live="polite" className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${online ? 'border-success/40 bg-success/10' : 'border-warning/50 bg-warning/10'}`}>
        {online ? <Wifi className="size-4 text-success" aria-hidden="true" /> : <WifiOff className="size-4 text-warning" aria-hidden="true" />}
        <span>{online ? 'Conectado' : 'Sin conexión. Tus cambios se guardan en el dispositivo.'}</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOnline(false)}>Simular desconexión</Button>
        <Button size="sm" variant="outline" onClick={() => setOnline(true)}>Reconectar</Button>
      </div>
    </div>
  )
}

function SlowLoad() {
  const [slow, setSlow] = useState(false)
  const [run, setRun] = useState(0)
  useEffect(() => { setSlow(false); const t = setTimeout(() => setSlow(true), 2500); return () => clearTimeout(t) }, [run])
  return (
    <div className="space-y-2" aria-live="polite">
      <Progress value={slow ? 70 : 35} aria-label="Cargando" />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Hourglass className="size-4" aria-hidden="true" />
        {slow ? 'Está tardando más de lo normal. Seguimos intentando.' : 'Cargando tus pedidos…'}
      </p>
      <Button size="sm" variant="outline" onClick={() => setRun((r) => r + 1)}>Volver a medir</Button>
    </div>
  )
}

export function ErrorPatterns() {
  const [blockFailed, setBlockFailed] = useState(true)
  const [expired, setExpired] = useState(false)
  return (
    <div className="grid gap-4 medium:grid-cols-2">
      <Block title="Error dentro de un bloque" text="Falla una parte; el resto de la pantalla sigue funcionando. Reintentar solo recarga ese bloque.">
        {blockFailed
          ? <EmptyState kind="error" title="No pudimos cargar las ventas" onRetry={() => setBlockFailed(false)} />
          : <Alert variant="success"><AlertTitle>Ventas cargadas</AlertTitle><AlertDescription><Button size="sm" variant="ghost" onClick={() => setBlockFailed(true)}>Volver a fallar</Button></AlertDescription></Alert>}
      </Block>
      <Block title="Banner de conexión" text="Aparece solo si se pierde la conexión y avisa cuando vuelve. Funciona con los eventos reales del navegador."><ConnectionBanner /></Block>
      <Block title="Sesión expirada" text="Una alerta (no se cierra tocando fuera) que explica por qué y conserva el trabajo en curso.">
        <Button size="sm" onClick={() => setExpired(true)}>Simular sesión expirada</Button>
        <AlertDialog open={expired} onOpenChange={setExpired}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tu sesión expiró</AlertDialogTitle>
              <AlertDialogDescription>Por seguridad cerramos la sesión tras 30 minutos sin actividad. Inicia sesión para continuar: guardamos lo que estabas editando.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Más tarde</AlertDialogCancel>
              <AlertDialogAction>Iniciar sesión</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Block>
      <Block title="Carga lenta" text="Si algo tarda más de lo normal, se dice. Esperar sin explicación se vive como un fallo."><SlowLoad /></Block>
    </div>
  )
}
