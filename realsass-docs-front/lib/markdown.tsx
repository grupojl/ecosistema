/**
 * lib/markdown.tsx — renderer mínimo de Markdown a elementos React (sin dependencias nuevas, ADR-018).
 *
 * Cubre lo que usan los docs: títulos, párrafos, listas, citas, bloques de código, `código`, **negrita** y enlaces.
 * No usa dangerouslySetInnerHTML: todo es texto escapado por React. Los enlaces solo aceptan http(s), mailto y rutas propias.
 */
import type { ReactNode } from 'react'

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g
const SAFE_HREF = /^(https?:\/\/|mailto:|\/|#)/i

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const [token] = m
    const key = `${keyBase}-${i++}`
    if (token.startsWith('`')) {
      out.push(<code key={key}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**')) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      const label = link?.[1] ?? token
      const href = link?.[2] ?? ''
      out.push(SAFE_HREF.test(href) ? <a key={key} href={href}>{label}</a> : label)
    }
    last = at + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let n = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''
    const key = `b${n++}`

    if (line.trim() === '') { i++; continue }

    if (line.startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) code.push(lines[i++] ?? '')
      i++
      blocks.push(<pre key={key}><code>{code.join('\n')}</code></pre>)
      continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1]?.length ?? 1
      const content = inline(heading[2] ?? '', key)
      blocks.push(level === 1 ? <h1 key={key}>{content}</h1> : level === 2 ? <h2 key={key}>{content}</h2> : <h3 key={key}>{content}</h3>)
      i++
      continue
    }

    if (line.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && (lines[i] ?? '').startsWith('>')) quote.push((lines[i++] ?? '').replace(/^>\s?/, ''))
      blocks.push(<blockquote key={key}>{inline(quote.join(' '), key)}</blockquote>)
      continue
    }

    const ordered = /^\d+\.\s+/.test(line)
    if (ordered || /^[-*]\s+/.test(line)) {
      const pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/
      const items: string[] = []
      while (i < lines.length && pattern.test(lines[i] ?? '')) items.push((lines[i++] ?? '').replace(pattern, ''))
      const lis = items.map((t, idx) => <li key={`${key}-${idx}`}>{inline(t, `${key}-${idx}`)}</li>)
      blocks.push(ordered ? <ol key={key}>{lis}</ol> : <ul key={key}>{lis}</ul>)
      continue
    }

    const para: string[] = []
    while (i < lines.length && (lines[i] ?? '').trim() !== '' && !/^(#{1,3}\s|```|>|[-*]\s|\d+\.\s)/.test(lines[i] ?? '')) {
      para.push((lines[i++] ?? '').trim())
    }
    blocks.push(<p key={key}>{inline(para.join(' '), key)}</p>)
  }

  return <>{blocks}</>
}
