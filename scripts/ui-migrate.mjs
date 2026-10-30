#!/usr/bin/env node
/**
 * ui-migrate — migra la UI desde su taller (realsass-design-front/ui) hacia el paquete compartido (packages/ui/src).
 *
 *   pnpm ui:check     Revisar (dry-run): exports y firmas, dependencias, edición manual del paquete y HTML/colores sueltos
 *                     en los fronts. No toca nada.
 *   pnpm ui:migrate   Aplicar: respalda packages/ui/src, lo reemplaza por el taller y regenera el barrel.
 *                     Se niega si rompe algo, si faltan dependencias o si el paquete fue editado a mano (no se pisa en silencio).
 *   pnpm ui:verify    Verificar: tipado (y --build) de los fronts. Si algo falla, la migración NO se da por buena.
 *   pnpm ui:guard     Guarda (CI / pre-commit): falla si packages/ui/src cambió respecto de la última migración.
 *   pnpm ui:lint      Detalle de HTML y colores sueltos en las piezas de cada front.
 *   pnpm ui:restore   Volver al último respaldo (o --from <carpeta>).
 *
 * Flags: --force (aplicar pese a rupturas o ediciones manuales) · --build (verify también compila) · --verify (migrate
 *        verifica al terminar) · --strict (check/lint fallan también por HTML/colores sueltos; guard exige igualdad con el taller)
 *        · --from <respaldo>
 * Fuente de verdad: realsass-design-front/ui. packages/ui/src es un artefacto generado: no se edita a mano.
 * La línea base de la guarda es packages/ui/src/.ui-synced.json (hash de cada archivo en la última migración).
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.env.UI_SRC ? path.resolve(process.env.UI_SRC) : path.join(ROOT, 'realsass-design-front', 'ui')
const DEST = path.join(ROOT, 'packages', 'ui', 'src')
const BACKUPS = path.join(ROOT, '.ui-backup')
const ENTRIES = ['components', 'hooks', 'utils', 'styles', 'index.ts']

/** Fronts que consumen @real/ui (nombre de workspace). El taller se verifica siempre. */
const CONSUMERS = ['realsass-sass-front', 'realsass-dashboard-front', 'real-ecommerce-front', 'realsass-docs-front']
const WORKSHOP = 'realsass-design-front'

const [, , mode = 'check', ...rest] = process.argv
const flag = (n) => rest.includes(`--${n}`)
const opt = (n) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined }

const c = { r: (s) => `\x1b[31m${s}\x1b[0m`, g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m` }

// ── utilidades de archivos ─────────────────────────────────────────────────────
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const walk = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  : []
const rel = (root, f) => path.relative(root, f).split(path.sep).join('/')
const hash = (f) => crypto.createHash('sha1').update(read(f)).digest('hex')
const entryFiles = (root) => ENTRIES.flatMap((e) => { const p = path.join(root, e); return fs.existsSync(p) ? (fs.statSync(p).isDirectory() ? walk(p) : [p]) : [] })

// ── análisis de exports ────────────────────────────────────────────────────────
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Cuerpo de `{ ... }` desde el índice de la llave de apertura. */
function braceBody(s, open) {
  let d = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') d++
    else if (s[i] === '}' && --d === 0) return s.slice(open, i + 1)
  }
  return s.slice(open)
}

/** Nombres exportados y firmas (interfaces / tipos) de un archivo. */
function analyzeFile(file) {
  const src = stripComments(read(file))
  const values = new Set(), types = new Set(), sigs = {}
  for (const m of src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class|enum)\s+(\w+)/g)) values.add(m[1])
  for (const m of src.matchAll(/export\s+(type|interface)\s+(\w+)/g)) {
    types.add(m[2])
    const after = src.slice(m.index + m[0].length)
    const brace = after.indexOf('{'), eq = after.indexOf('=')
    const body = m[1] === 'interface'
      ? `${after.slice(0, brace).replace(/\s+/g, ' ')}${braceBody(after, brace)}`
      : after.slice(eq, after.indexOf('\n\n') > -1 ? after.indexOf('\n\n') : undefined)
    sigs[m[2]] = body.replace(/\s+/g, ' ').trim()
  }
  for (const m of src.matchAll(/export\s+(type\s+)?\{([^}]*)\}/g)) {
    for (const part of m[2].split(',')) {
      const t = part.trim(); if (!t) continue
      const isType = !!m[1] || /^type\s/.test(t)
      const name = t.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim()
      ;(isType ? types : values).add(name)
    }
  }
  return { values, types, sigs }
}

/** Todos los exports públicos de un árbol (siguiendo el barrel index.ts). */
function collectExports(root) {
  const idx = path.join(root, 'index.ts')
  const all = { values: new Set(), types: new Set(), sigs: {} }
  const add = (a) => { a.values.forEach((v) => all.values.add(v)); a.types.forEach((v) => all.types.add(v)); Object.assign(all.sigs, a.sigs) }
  if (!fs.existsSync(idx)) return all
  const src = stripComments(read(idx))
  add(analyzeFile(idx))
  for (const m of src.matchAll(/export\s+\*\s+from\s+['"](.+?)['"]/g)) {
    const base = path.join(root, m[1])
    const f = ['.ts', '.tsx'].map((e) => base + e).find((p) => fs.existsSync(p))
    if (f) add(analyzeFile(f))
  }
  return all
}

// ── consumo en los fronts ──────────────────────────────────────────────────────
/** Nombres que cada front importa de '@real/ui' (con el archivo donde aparecen). */
function collectConsumption() {
  const used = new Map() // nombre -> Set(front/archivo)
  for (const front of CONSUMERS) {
    const dir = path.join(ROOT, front)
    for (const f of walk(dir)) {
      if (!/\.(ts|tsx)$/.test(f) || /node_modules|[\\/]\.next[\\/]/.test(f)) continue
      const src = read(f)
      for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]@real\/ui['"]/g)) {
        for (const part of m[1].split(',')) {
          const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
          if (!name) continue
          if (!used.has(name)) used.set(name, new Set())
          used.get(name).add(`${front}/${rel(dir, f)}`)
        }
      }
    }
  }
  return used
}

// ── guarda: línea base de la última migración ─────────────────────────────────
const MANIFEST = path.join(DEST, '.ui-synced.json')
const hashesOf = (root) => Object.fromEntries(entryFiles(root).map((f) => [rel(root, f), hash(f)]).sort(([a], [b]) => a.localeCompare(b)))

/** Archivos de packages/ui/src que cambiaron desde la última migración (edición manual). */
function drift() {
  if (!fs.existsSync(MANIFEST)) return { baseline: false, edited: [], added: [], removed: [] }
  const base = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).files ?? null
  if (!base) return { baseline: false, edited: [], added: [], removed: [] }
  const now = hashesOf(DEST)
  return {
    baseline: true,
    edited: Object.keys(now).filter((k) => k in base && base[k] !== now[k]),
    added: Object.keys(now).filter((k) => !(k in base)),
    removed: Object.keys(base).filter((k) => !(k in now)),
  }
}

// ── dependencias: lo que importa el taller debe existir en packages/ui ─────────
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const pkgName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0])
const BUILTIN = new Set(['react', 'react-dom'])   // peerDependencies del paquete

function depsReport() {
  const pkg = readJson(path.join(ROOT, 'packages', 'ui', 'package.json'))
  const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})])
  const used = new Map()
  for (const f of entryFiles(SRC).filter((x) => /\.(ts|tsx)$/.test(x))) {
    for (const m of read(f).matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
      const s = m[1]
      if (s.startsWith('.') || s.startsWith('@real/ui') || s.startsWith('node:')) continue
      const name = pkgName(s)
      if (!used.has(name)) used.set(name, new Set())
      used.get(name).add(rel(SRC, f))
    }
  }
  const missing = [...used.keys()].filter((n) => !declared.has(n) && !BUILTIN.has(n)).sort()
  const shop = path.join(ROOT, WORKSHOP, 'package.json')
  const wk = fs.existsSync(shop) ? { ...(readJson(shop).dependencies ?? {}) } : {}
  const mismatched = Object.entries(pkg.dependencies ?? {}).filter(([n, v]) => wk[n] !== v).map(([n, v]) => `${n}: paquete «${v}» · taller «${wk[n] ?? 'falta'}»`)
  const unused = Object.keys(pkg.dependencies ?? {}).filter((n) => !used.has(n))
  return { missing, mismatched, unused, used }
}

// ── fronts: HTML y colores sueltos en sus piezas ──────────────────────────────
const PALETTE = 'gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const RULES = [
  { id: 'html', label: 'HTML suelto (usa Button, Input, NativeSelect, Textarea, Table de @real/ui)', re: /<(button|input|select|textarea|table)[\s>]/, skip: /type=["'](color|file|hidden)["']/ },
  { id: 'color', label: 'Color fuera de los tokens (usa bg-primary, text-muted-foreground…)', re: new RegExp(`\\b(?:text|bg|border|ring|fill|stroke|from|to|via|divide|outline)-(?:${PALETTE})-\\d{2,3}\\b|\\b(?:text|bg|border|ring|fill|stroke)-\\[#[0-9a-fA-F]{3,8}\\]`) },
  { id: 'hex', label: 'Hex en fill/stroke/color/background (los logos de proveedores viven en @real/ui)', re: /\b(?:fill|stroke|color|background(?:Color)?)\s*[:=]\s*["'{`]*#[0-9a-fA-F]{3,8}/ },
]

function frontsLint() {
  const out = {}
  for (const front of CONSUMERS) {
    const dir = path.join(ROOT, front)
    const hits = []
    for (const f of walk(dir)) {
      if (!/\.tsx$/.test(f) || /node_modules|[\\/]\.next[\\/]|\.(spec|test)\.tsx$/.test(f)) continue
      read(f).split('\n').forEach((line, i) => {
        if (/ui-lint-ignore/.test(line)) return
        for (const r of RULES) if (r.re.test(line) && !(r.skip && r.skip.test(line))) hits.push({ rule: r.id, file: rel(dir, f), line: i + 1, text: line.trim().slice(0, 110) })
      })
    }
    out[front] = hits
  }
  return out
}

function printLint(all, full) {
  let total = 0
  for (const [front, hits] of Object.entries(all)) {
    total += hits.length
    console.log(`  ${front.padEnd(28)} ${hits.length ? c.y(`${hits.length} hallazgos`) : c.g('limpio')}`)
    if (full) for (const h of hits.slice(0, 200)) console.log(c.d(`      ${h.file}:${h.line}  [${h.rule}] `) + h.text)
  }
  if (full) { console.log(); for (const r of RULES) console.log(c.d(`  [${r.id}] ${r.label}`)); console.log(c.d('  Para excepciones justificadas, agrega «ui-lint-ignore» en la misma línea.')) }
  return total
}

// ── informe ────────────────────────────────────────────────────────────────────
function report() {
  const cur = collectExports(DEST), next = collectExports(SRC)
  const curAll = new Set([...cur.values, ...cur.types]), nextAll = new Set([...next.values, ...next.types])
  const removed = [...curAll].filter((n) => !nextAll.has(n)).sort()
  const added = [...nextAll].filter((n) => !curAll.has(n)).sort()
  const changedSigs = Object.keys(next.sigs).filter((n) => cur.sigs[n] && cur.sigs[n] !== next.sigs[n]).sort()

  const used = collectConsumption()
  const broken = [...used.keys()].filter((n) => !nextAll.has(n)).sort()
  const removedUsed = removed.filter((n) => used.has(n))
  const sigUsed = changedSigs.filter((n) => used.has(n))

  const curFiles = new Map(entryFiles(DEST).map((f) => [rel(DEST, f), hash(f)]))
  const nextFiles = new Map(entryFiles(SRC).map((f) => [rel(SRC, f), hash(f)]))
  const fAdded = [...nextFiles.keys()].filter((k) => !curFiles.has(k))
  const fRemoved = [...curFiles.keys()].filter((k) => !nextFiles.has(k))
  const fChanged = [...nextFiles.keys()].filter((k) => curFiles.has(k) && curFiles.get(k) !== nextFiles.get(k))

  console.log(c.b('\nUI · revisión de migración'))
  console.log(c.d(`  desde  ${rel(ROOT, SRC)}\n  hacia  ${rel(ROOT, DEST)}\n`))
  console.log(`  Archivos   ${c.g(`+${fAdded.length}`)} nuevos · ${c.y(`~${fChanged.length}`)} modificados · ${fRemoved.length ? c.r(`-${fRemoved.length}`) : '-0'} eliminados`)
  console.log(`  Exports    ${c.g(`+${added.length}`)} nuevos · ${removed.length ? c.r(`-${removed.length}`) : '-0'} quitados · ${changedSigs.length ? c.y(`~${changedSigs.length}`) : '~0'} firmas distintas`)
  console.log(`  Consumo    ${used.size} nombres importados de @real/ui en ${CONSUMERS.length} fronts\n`)

  const list = (title, items, color, max = 40) => {
    if (!items.length) return
    console.log(color(`  ${title}`))
    items.slice(0, max).forEach((i) => console.log(`    ${i}`))
    if (items.length > max) console.log(c.d(`    … y ${items.length - max} más`))
    console.log()
  }
  list('Archivos nuevos', fAdded, c.g)
  list('Archivos modificados', fChanged, c.y)
  list('Archivos que se eliminarían', fRemoved, c.r)
  list('Exports nuevos', added, c.g)
  list('Exports quitados', removed.map((n) => `${n}${used.has(n) ? c.r('  ← lo usan los fronts') : ''}`), c.r)
  list('Firmas (props/tipos) distintas', changedSigs.map((n) => `${n}${used.has(n) ? c.y('  ← lo usan los fronts') : ''}`), c.y)

  if (broken.length) {
    console.log(c.r('  ✗ Los fronts importan nombres que el nuevo conjunto NO exporta:'))
    for (const n of broken) console.log(`    ${n}  ${c.d([...used.get(n)].slice(0, 2).join(', '))}`)
    console.log()
  }
  const exportsOk = broken.length === 0 && removedUsed.length === 0
  console.log(exportsOk ? c.g('  ✓ Ningún front pierde un export que usa.') : c.r('  ✗ Hay rupturas: corrige el taller o usa --force bajo tu responsabilidad.'))
  if (sigUsed.length) console.log(c.y(`  ! Revisa a mano las firmas distintas que los fronts usan: ${sigUsed.join(', ')}`))

  // Dependencias
  const deps = depsReport()
  const depsOk = deps.missing.length === 0
  if (depsOk) console.log(c.g(`  ✓ Dependencias: ${deps.used.size} librerías externas, todas declaradas en packages/ui.`))
  else { console.log(c.r('  ✗ El taller importa librerías que packages/ui/package.json no declara (se romperían al migrar):')); deps.missing.forEach((m) => console.log(`    ${m}  ${c.d([...deps.used.get(m)].slice(0, 2).join(', '))}`)) }
  if (deps.mismatched.length) { console.log(c.y('  ! Versiones distintas entre el taller y el paquete:')); deps.mismatched.forEach((m) => console.log(`    ${m}`)) }
  if (deps.unused.length) console.log(c.d(`  · Declaradas en el paquete pero sin uso en el taller: ${deps.unused.join(', ')}`))

  // Edición manual del paquete
  const d = drift()
  const driftN = d.edited.length + d.added.length + d.removed.length
  if (!d.baseline) console.log(c.y('  ! Sin línea base: el paquete nunca se migró con este script. Se creará al aplicar.'))
  else if (driftN === 0) console.log(c.g('  ✓ packages/ui/src no fue editado a mano desde la última migración.'))
  else {
    console.log(c.r(`  ✗ packages/ui/src fue editado a mano (${driftN} archivos): migrar los pisaría.`))
    ;[...d.edited.map((f) => `~ ${f}`), ...d.added.map((f) => `+ ${f}`), ...d.removed.map((f) => `- ${f}`)].slice(0, 15).forEach((l) => console.log(`    ${l}`))
    console.log(c.d('    Súbelos al taller (realsass-design-front/ui) o usa --force si son descartables.'))
  }

  // HTML y colores sueltos en los fronts
  console.log(c.b('\n  Piezas de los fronts (HTML y colores sueltos)'))
  const lintTotal = printLint(frontsLint(), false)
  if (lintTotal) console.log(c.d('  Detalle: pnpm ui:lint'))
  console.log()
  const strictLintOk = !flag('strict') || lintTotal === 0
  return { ok: exportsOk && depsOk && strictLintOk, exportsOk, depsOk, driftN, changes: fAdded.length + fChanged.length + fRemoved.length, lintTotal }
}

// ── aplicar / restaurar ────────────────────────────────────────────────────────
function copyEntry(from, to) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.cpSync(from, to, { recursive: true })
}

function writeManifest(backup) {
  fs.writeFileSync(MANIFEST, JSON.stringify({ syncedAt: new Date().toISOString(), from: rel(ROOT, SRC), backup: backup ? rel(ROOT, backup) : null, files: hashesOf(DEST) }, null, 2) + '\n')
}

function apply() {
  const r = report()
  if (!r.ok && !flag('force')) { console.log(c.r('Migración cancelada: nada se modificó.\n')); process.exit(1) }
  // Nunca se pisa en silencio una edición manual del paquete.
  if (r.driftN > 0 && !flag('force')) {
    console.log(c.r('Migración cancelada: packages/ui/src tiene ediciones manuales que se perderían (ver arriba). Nada se modificó.\n'))
    process.exit(1)
  }
  if (r.changes === 0) {
    if (!drift().baseline || r.driftN > 0) { writeManifest(null); console.log(c.g('Línea base de la guarda registrada (packages/ui ya coincide con el taller).\n')) }
    else console.log(c.g('packages/ui ya es idéntico al taller: no hay nada que migrar.\n'))
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const bk = path.join(BACKUPS, stamp)
  fs.mkdirSync(bk, { recursive: true })
  for (const e of ENTRIES) { const p = path.join(DEST, e); if (fs.existsSync(p)) fs.cpSync(p, path.join(bk, e), { recursive: true }) }
  if (fs.existsSync(MANIFEST)) fs.copyFileSync(MANIFEST, path.join(bk, '.ui-synced.json'))
  console.log(c.d(`  Respaldo: ${rel(ROOT, bk)}`))

  for (const e of ENTRIES) copyEntry(path.join(SRC, e), path.join(DEST, e))
  writeManifest(bk)

  console.log(c.g('\n✓ packages/ui/src actualizado desde el taller.'))
  if (flag('verify')) return verify()
  console.log(`  Siguiente paso:  ${c.b('pnpm ui:verify')}   (tipado de los fronts; --build para compilar; o  pnpm ui:migrate --verify)`)
  console.log(`  Si algo sale mal: ${c.b('pnpm ui:restore')}\n`)
}

/** Guarda para CI / pre-commit: el paquete solo cambia por ui:migrate. */
function guard() {
  const d = drift()
  const n = d.edited.length + d.added.length + d.removed.length
  console.log(c.b('\nUI · guarda de packages/ui/src\n'))
  if (!d.baseline) { console.log(c.r('✗ Sin línea base. Ejecuta  pnpm ui:migrate  una vez para registrarla.\n')); process.exit(1) }
  if (n > 0) {
    console.log(c.r(`✗ packages/ui/src fue editado a mano desde la última migración (${n} archivos):`))
    ;[...d.edited.map((f) => `~ ${f}`), ...d.added.map((f) => `+ ${f}`), ...d.removed.map((f) => `- ${f}`)].forEach((l) => console.log(`    ${l}`))
    console.log(c.d('\n  Ese paquete es un artefacto generado. Haz el cambio en realsass-design-front/ui y migra con  pnpm ui:migrate.\n'))
    process.exit(1)
  }
  console.log(c.g('✓ packages/ui/src coincide con la última migración.'))
  if (flag('strict')) {
    const a = hashesOf(SRC), b = hashesOf(DEST)
    const diff = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k])
    if (diff.length) { console.log(c.r(`✗ --strict: el taller tiene ${diff.length} archivos distintos del paquete (migración pendiente):`)); diff.slice(0, 15).forEach((f) => console.log(`    ${f}`)); console.log(); process.exit(1) }
    console.log(c.g('✓ --strict: el taller y el paquete son idénticos.'))
  }
  console.log()
}

function lint() {
  console.log(c.b('\nUI · piezas de los fronts: HTML y colores sueltos\n'))
  const total = printLint(frontsLint(), true)
  console.log(total ? c.y(`\n${total} hallazgos.${flag('strict') ? '' : ' (usa --strict para que falle)'}\n`) : c.g('\n✓ Los fronts solo usan componentes y tokens de @real/ui.\n'))
  process.exit(total && flag('strict') ? 1 : 0)
}

function restore() {
  if (!fs.existsSync(BACKUPS)) { console.log(c.r('No hay respaldos.\n')); process.exit(1) }
  const name = opt('from') ?? fs.readdirSync(BACKUPS).sort().pop()
  const bk = path.join(BACKUPS, name ?? '')
  if (!name || !fs.existsSync(bk)) { console.log(c.r('Respaldo no encontrado.\n')); process.exit(1) }
  for (const e of ENTRIES) { const p = path.join(bk, e); if (fs.existsSync(p)) copyEntry(p, path.join(DEST, e)) }
  const bm = path.join(bk, '.ui-synced.json')
  if (fs.existsSync(bm)) fs.copyFileSync(bm, MANIFEST); else fs.rmSync(MANIFEST, { force: true })
  console.log(c.g(`✓ packages/ui/src restaurado desde ${rel(ROOT, bk)}\n`))
}

// ── verificar ──────────────────────────────────────────────────────────────────
function verify() {
  const targets = [WORKSHOP, ...CONSUMERS]
  const scripts = flag('build') ? ['typecheck', 'build'] : ['typecheck']
  const results = []
  console.log(c.b('\nUI · verificación de los fronts\n'))
  for (const t of targets) {
    const pkg = path.join(ROOT, t, 'package.json')
    if (!fs.existsSync(pkg)) { results.push([t, 'omitido', 'no existe']); continue }
    const has = JSON.parse(fs.readFileSync(pkg, 'utf8')).scripts ?? {}
    for (const s of scripts) {
      if (!has[s]) { results.push([`${t} · ${s}`, 'omitido', 'sin script']); continue }
      process.stdout.write(`  ${t} · ${s} … `)
      const r = spawnSync('pnpm', ['--filter', t, s], { cwd: ROOT, shell: true, encoding: 'utf8', timeout: 20 * 60 * 1000 })
      const pass = r.status === 0
      console.log(pass ? c.g('ok') : c.r('FALLA'))
      results.push([`${t} · ${s}`, pass ? 'ok' : 'falla', pass ? '' : `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-12).join('\n')])
    }
  }
  const fails = results.filter((r) => r[1] === 'falla')
  console.log()
  for (const [n, , out] of fails) console.log(c.r(`✗ ${n}\n`) + c.d(out.split('\n').map((l) => '    ' + l).join('\n')) + '\n')
  console.log(fails.length ? c.r(`✗ ${fails.length} verificación(es) fallaron: la migración NO se da por buena (pnpm ui:restore para volver).\n`) : c.g('✓ Todos los fronts pasan. La migración se da por buena.\n'))
  console.log(c.y('  Recuerda: compilar no revisa el diseño. Mira el dashboard, la tienda y sass-front en el navegador.\n'))
  process.exit(fails.length ? 1 : 0)
}

const modes = { check: () => { const { ok } = report(); process.exit(ok ? 0 : 1) }, apply, migrate: apply, verify, restore, guard, lint }
if (!modes[mode]) { console.log(`Modo desconocido «${mode}». Usa: check | apply | verify | guard | lint | restore`); process.exit(2) }
modes[mode]()
