'use client'
/**
 * reveal-secret-dialog.tsx — muestra un secreto recién generado UNA sola vez.
 *
 * Después de cerrar este diálogo el valor no se puede recuperar (el servidor solo guarda una versión
 * cifrada y una pista de 4 caracteres). Por eso no se cierra con click afuera ni con Escape: hay que
 * confirmar que se guardó.
 */
import { useState }                from 'react'
import { Check, Copy, TriangleAlert } from 'lucide-react'
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@real/ui'

interface Props {
  title:   string
  secret:  string | null
  onClose: () => void
}

export function RevealSecretDialog({ title, secret, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* el portapapeles puede estar bloqueado: queda el campo para copiar a mano */ }
  }

  return (
    <Dialog open={secret !== null} onOpenChange={() => { /* solo se cierra con el botón */ }}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="flex items-start gap-2 text-amber-600">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Copiala ahora. Por seguridad no vas a poder verla de nuevo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={secret ?? ''}
            onFocus={e => e.currentTarget.select()}
            aria-label="Valor del secreto"
            className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-xs"
          />
          <Button type="button" size="sm" variant="outline" onClick={copy} aria-label="Copiar">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => { setCopied(false); onClose() }}>Ya la guardé</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
