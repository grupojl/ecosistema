'use client'

import { Children, isValidElement, useId, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@real/ui'

/** Componentes interactivos de la whitelist: copiar código y pestañas. */

export function CodeBlock({ content, language }: { content: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Sin permiso de portapapeles: el usuario puede seleccionar el texto a mano.
    }
  }

  return (
    <div className="docs-code group relative my-6 overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between border-b bg-muted/60 px-4 py-1.5 text-xs text-muted-foreground">
        <span className="font-mono uppercase tracking-wide">{language ?? 'texto'}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Copiar código"
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono">{content.replace(/\n$/, '')}</code>
      </pre>
    </div>
  )
}

export function Tabs({ labels, children }: { labels: string[]; children?: ReactNode }) {
  const [active, setActive] = useState(0)
  const uid = useId()
  const panels = Children.toArray(children).filter(isValidElement)

  return (
    <div className="my-6">
      <div role="tablist" className="flex gap-1 border-b">
        {labels.map((label, index) => (
          <button
            key={label}
            role="tab"
            type="button"
            id={`${uid}-tab-${index}`}
            aria-selected={active === index}
            onClick={() => setActive(index)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active === index
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-labelledby={`${uid}-tab-${active}`} className="pt-2">
        {panels[active]}
      </div>
    </div>
  )
}

export function Tab({ children }: { label: string; children?: ReactNode }) {
  return <div>{children}</div>
}
