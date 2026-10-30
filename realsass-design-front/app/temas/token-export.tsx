'use client'

import { useEffect, useState } from 'react'
import { Copy, Download } from 'lucide-react'
import { toast } from '@/components/ui'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'

type Theme = Record<string, string>
interface Tokens { light: Theme; dark: Theme }

/** Recorre las hojas de estilo (y @layer / @media anidados) juntando las variables de las reglas `:root` y `.dark`. */
function collect(rules: CSSRuleList, into: Tokens) {
  for (const r of Array.from(rules)) {
    if (r instanceof CSSStyleRule) {
      const sel = r.selectorText.split(',').map((s) => s.trim())
      const target = sel.includes('.dark') ? into.dark : sel.includes(':root') ? into.light : null
      if (!target) continue
      for (let i = 0; i < r.style.length; i++) {
        const p = r.style[i]
        if (p.startsWith('--') && !/^--(tw|font|ease|breakpoint|default|spacing|radius-)/.test(p)) target[p.slice(2)] = r.style.getPropertyValue(p).trim()
      }
    } else if ('cssRules' in r) collect((r as CSSGroupingRule).cssRules, into)
  }
}

function readTokens(): Tokens {
  const t: Tokens = { light: {}, dark: {} }
  for (const sheet of Array.from(document.styleSheets)) {
    try { collect(sheet.cssRules, t) } catch { /* hoja de otro origen */ }
  }
  // Solo los tokens de Welver (colores, radio y gráficos); descarta variables propias de otras librerías.
  const keep = (o: Theme) => Object.fromEntries(Object.entries(o).filter(([k, v]) => /^(hsl|#)/.test(v) || k === 'radius'))
  return { light: keep(t.light), dark: keep(t.dark) }
}

const block = (sel: string, t: Theme) => `${sel} {\n${Object.entries(t).map(([k, v]) => `  --${k}: ${v};`).join('\n')}\n}`
const toCss = (t: Tokens) => `${block(':root', t.light)}\n\n${block('.dark', t.dark)}\n\n@custom-variant dark (&:is(.dark *));\n`

const toTheme = (t: Tokens) => `/* theme.css — mapeo de los tokens a Tailwind v4 (los valores viven en tokens.css) */
@theme {
  --breakpoint-medium: 37.5rem;     /* compact < 600 */
  --breakpoint-expanded: 52.5rem;   /* medium 600–839 · expanded >= 840 */
}

@theme inline {
  --font-sans: var(--font-inter), Inter, system-ui, sans-serif;
  --font-display: var(--font-source-serif), 'Source Serif 4', Inter, system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace;
${Object.keys(t.light).filter((k) => k !== 'radius').map((k) => `  --color-${k}: var(--${k});`).join('\n')}
  --radius-sm: 5px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
`
const toJson = (t: Tokens) => JSON.stringify({ $schema: 'welver-tokens/1', ...t }, null, 2)

export function TokenExport() {
  const [tokens, setTokens] = useState<Tokens | null>(null)
  useEffect(() => { setTokens(readTokens()) }, [])

  const files = tokens
    ? ([
        ['css', 'tokens.css', toCss(tokens), 'text/css'],
        ['tailwind', 'theme.css', toTheme(tokens), 'text/css'],
        ['json', 'tokens.json', toJson(tokens), 'application/json'],
      ] as const)
    : []

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success('Copiado') } catch { toast.error('No se pudo copiar') }
  }
  const download = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  if (!tokens) return <p className="text-sm text-muted-foreground" role="status">Leyendo los tokens…</p>
  return (
    <Tabs defaultValue="css">
      <TabsList>{files.map(([id, name]) => <TabsTrigger key={id} value={id}>{name}</TabsTrigger>)}</TabsList>
      {files.map(([id, name, text, type]) => (
        <TabsContent key={id} value={id} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{(text.length / 1024).toFixed(1).replace('.', ',')} KB · {Object.keys(tokens.light).length} tokens</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(text)}><Copy /> Copiar</Button>
              <Button size="sm" variant="outline" onClick={() => download(name, text, type)}><Download /> Descargar</Button>
            </div>
          </div>
          <pre tabIndex={0} aria-label={`Contenido de ${name}`} className="max-h-96 overflow-auto rounded-lg border bg-muted p-3 font-mono text-xs">{text}</pre>
        </TabsContent>
      ))}
    </Tabs>
  )
}
