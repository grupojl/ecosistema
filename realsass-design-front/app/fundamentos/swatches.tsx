'use client'

import { toast } from '@/components/ui'

const TOKENS = [
  ['background', 'bg-background', 'text-foreground'], ['foreground', 'bg-foreground', 'text-background'],
  ['card', 'bg-card', 'text-card-foreground'], ['popover', 'bg-popover', 'text-foreground'],
  ['primary', 'bg-primary', 'text-primary-foreground'], ['secondary', 'bg-secondary', 'text-secondary-foreground'],
  ['accent', 'bg-accent', 'text-accent-foreground'], ['muted', 'bg-muted', 'text-muted-foreground'],
  ['success', 'bg-success', 'text-success-foreground'], ['warning', 'bg-warning', 'text-warning-foreground'],
  ['destructive', 'bg-destructive', 'text-destructive-foreground'], ['border', 'bg-border', 'text-foreground'],
  ['input', 'bg-input', 'text-background'], ['ring', 'bg-ring', 'text-primary-foreground'],
] as const

/** Muestras de los tokens de color: un clic copia `--color-<token>`. */
export function Swatches() {
  const copy = async (name: string) => {
    const text = `--color-${name}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Token copiado', { description: text })
    } catch {
      toast.error('No se pudo copiar', { description: text })
    }
  }
  return (
    <ul className="grid grid-cols-2 gap-3 medium:grid-cols-3 expanded:grid-cols-5">
      {TOKENS.map(([name, bg, fg]) => (
        <li key={name}>
          <button
            type="button"
            onClick={() => copy(name)}
            className={`${bg} ${fg} flex min-h-20 w-full flex-col items-start rounded-lg border p-3 text-left transition-transform active:scale-[.98]`}
            aria-label={`Copiar el token ${name}`}
          >
            <span className="text-sm font-medium">{name}</span>
            <span className="font-mono text-xs opacity-80">--color-{name}</span>
          </button>
        </li>
      ))}
      {(['success-ink', 'warning-ink', 'destructive-ink'] as const).map((n) => (
        <li key={n}>
          <button
            type="button"
            onClick={() => copy(n)}
            className="flex min-h-20 w-full flex-col items-start rounded-lg border bg-card p-3 text-left"
            aria-label={`Copiar el token ${n}`}
          >
            <span className={`text-sm font-semibold ${n === 'success-ink' ? 'text-success-ink' : n === 'warning-ink' ? 'text-warning-ink' : 'text-destructive-ink'}`}>{n}</span>
            <span className="font-mono text-xs text-muted-foreground">--color-{n}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
