/** Auditores en vivo sobre el DOM real (welver.html → «Accesibilidad» y «Norte»). Solo corren en el navegador. */

/** Resuelve el token `--<name>` (hsl(...)) a [r,g,b] 0–255 usando el color calculado por el navegador. */
export function tokenRgb(name: string): [number, number, number] | null {
  if (name === 'white') return [255, 255, 255]
  const el = document.createElement('span')
  el.style.color = `var(--${name})`
  el.hidden = true
  document.body.appendChild(el)
  const c = getComputedStyle(el).color
  el.remove()
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const [r, g, b] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
  return [r, g, b]
}

export function luminance([r, g, b]: readonly number[]): number {
  const c = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
}

export function ratio(a: readonly number[], b: readonly number[]): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

export interface Pair { name: string; fg: string; bg: string; min: number }

/** Pares de tokens que se exigen: texto normal 4,5:1 · UI y foco 3:1 (WCAG 1.4.3 y 1.4.11). */
export const PAIRS: readonly Pair[] = [
  { name: 'Texto sobre fondo', fg: 'foreground', bg: 'background', min: 4.5 },
  { name: 'Texto sobre tarjeta', fg: 'card-foreground', bg: 'card', min: 4.5 },
  { name: 'Texto de botón principal', fg: 'primary-foreground', bg: 'primary', min: 4.5 },
  { name: 'Texto secundario', fg: 'secondary-foreground', bg: 'secondary', min: 4.5 },
  { name: 'Texto de acento', fg: 'accent-foreground', bg: 'accent', min: 4.5 },
  { name: 'Texto de apoyo sobre fondo', fg: 'muted-foreground', bg: 'background', min: 4.5 },
  { name: 'Texto de apoyo sobre muted', fg: 'muted-foreground', bg: 'muted', min: 4.5 },
  { name: 'Éxito (texto ink)', fg: 'success-ink', bg: 'background', min: 4.5 },
  { name: 'Peligro (texto ink)', fg: 'destructive-ink', bg: 'background', min: 4.5 },
  { name: 'Aviso (texto ink)', fg: 'warning-ink', bg: 'background', min: 4.5 },
  { name: 'Botón principal (relleno real)', fg: 'white', bg: 'primary-solid', min: 4.5 },
  { name: 'Botón destructivo (relleno real)', fg: 'white', bg: 'destructive-solid', min: 4.5 },
  { name: 'Token destructive-foreground sobre destructive', fg: 'destructive-foreground', bg: 'destructive', min: 4.5 },
  { name: 'Acento dorado', fg: 'gold', bg: 'background', min: 4.5 },
  { name: 'Borde de control', fg: 'input', bg: 'background', min: 3 },
  { name: 'Anillo de foco', fg: 'ring', bg: 'background', min: 3 },
]

export interface PairResult extends Pair { ratio: number; ok: boolean; fgRgb: number[]; bgRgb: number[] }

export function contrastTable(): PairResult[] {
  return PAIRS.flatMap((p) => {
    const fg = tokenRgb(p.fg), bg = tokenRgb(p.bg)
    if (!fg || !bg) return []
    const r = ratio(fg, bg)
    return [{ ...p, ratio: r, ok: r >= p.min, fgRgb: fg, bgRgb: bg }]
  })
}

export interface Finding { sev: 'error' | 'warn'; msg: string; where?: string }

const describe = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`

/** Color de fondo efectivo: sube por los ancestros hasta encontrar uno opaco. */
function effectiveBg(el: Element): [number, number, number] {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const m = getComputedStyle(n).backgroundColor.match(/rgba?\(([^)]+)\)/)
    if (m) {
      const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean)
      if (+a > 0.95) return [+r, +g, +b]
    }
  }
  return tokenRgb('background') ?? [255, 255, 255]
}

export function a11yAudit(): { out: Finding[]; checked: number } {
  const out: Finding[] = []
  let checked = 0
  const ids = new Map<string, number>()
  document.querySelectorAll('[id]:not([id=""])').forEach((e) => ids.set(e.id, (ids.get(e.id) ?? 0) + 1))
  ids.forEach((n, id) => { if (n > 1) out.push({ sev: 'error', msg: `id duplicado «${id}» (${n} veces)` }) })

  document.querySelectorAll('button, a[href], [role="button"]').forEach((el) => {
    const labelled = ((el as HTMLButtonElement).labels?.length ?? 0) > 0   // <label> que envuelve al control (p. ej. casillas de Radix)
    const name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent || el.getAttribute('title') || '').trim()
    if (!name && !labelled) out.push({ sev: 'error', msg: 'Control sin nombre accesible', where: describe(el) })
  })
  document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach((el) => {
    const input = el as HTMLInputElement
    const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (input.labels && input.labels.length > 0)
    if (!labelled) out.push({ sev: 'error', msg: 'Campo sin etiqueta', where: describe(el) })
  })
  document.querySelectorAll('[aria-labelledby], [aria-describedby]').forEach((el) => {
    for (const attr of ['aria-labelledby', 'aria-describedby']) {
      el.getAttribute(attr)?.split(/\s+/).forEach((id) => {
        if (id && !document.getElementById(id)) out.push({ sev: 'warn', msg: `${attr} apunta a «${id}», que no existe`, where: describe(el) })
      })
    }
  })
  const h1 = document.querySelectorAll('h1').length
  if (h1 !== 1) out.push({ sev: 'warn', msg: `Hay ${h1} <h1>; debe haber uno por página` })
  let prev = 0
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
    const lvl = +h.tagName[1]
    if (prev && lvl > prev + 1) out.push({ sev: 'warn', msg: `Salto de título h${prev} → h${lvl}`, where: (h.textContent ?? '').slice(0, 40) })
    prev = lvl
  })
  if (!document.querySelector('main')) out.push({ sev: 'error', msg: 'Falta el landmark <main>' })

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set<Element>()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!el || seen.has(el) || !(n.textContent ?? '').trim()) continue
    seen.add(el)
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[aria-hidden="true"], script, style')) continue
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) continue
    const m = cs.color.match(/rgba?\(([^)]+)\)/)
    if (!m) continue
    const [r, g, b] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
    checked++
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
    const cr = ratio([r, g, b], effectiveBg(el))
    if (cr < need) {
      out.push({ sev: 'warn', msg: `Contraste ${cr.toFixed(2).replace('.', ',')}:1 (mín. ${String(need).replace('.', ',')}:1)`, where: `${describe(el)} «${(n.textContent ?? '').trim().slice(0, 30)}»` })
    }
  }
  return { out: out.slice(0, 60), checked }
}

export const isCoarse = () => matchMedia('(pointer: coarse)').matches

export function sizeClassNow(): 'compact' | 'medium' | 'expanded' {
  return innerWidth < 600 ? 'compact' : innerWidth < 840 ? 'medium' : 'expanded'
}

export function auditTouch(): { n: number; bad: { name: string; w: number; h: number }[] } {
  const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role="button"], [role="tab"], summary'
  const bad: { name: string; w: number; h: number }[] = []
  let n = 0
  document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return
    if (el.matches('a') && el.closest('p')) return   // enlaces dentro de un párrafo: exentos (WCAG 2.5.8)
    n++
    if (r.width < 43.5 || r.height < 43.5) {
      bad.push({ name: `${describe(el)} «${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}»`, w: Math.round(r.width), h: Math.round(r.height) })
    }
  })
  return { n, bad: bad.slice(0, 40) }
}
