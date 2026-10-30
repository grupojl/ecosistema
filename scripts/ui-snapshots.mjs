#!/usr/bin/env node
/**
 * ui-snapshots — capturas de las pantallas clave del taller (claro/oscuro × escritorio/celular) para detectar cambios de aspecto.
 *
 *   pnpm ui:snap        Actualiza la línea base (realsass-design-front/snapshots/). Hazlo cuando el cambio de aspecto sea INTENCIONAL.
 *   pnpm ui:snapcheck   Captura de nuevo y compara píxel a píxel con la línea base. Falla si algo cambió más del umbral.
 *
 * Requiere el taller en marcha (pnpm --filter realsass-design-front dev → http://localhost:3026) y Chrome.
 * Flags: --base <url> · --only <texto> (filtra por nombre) · --threshold <fracción de píxeles, def. 0.002>
 * Variables: CHROME_PATH para un Chrome en otra ruta.
 *
 * Qué NO es: no mira los fronts con datos reales (necesitan backend) ni reemplaza una revisión humana; detecta que «algo cambió»
 * en pantallas deterministas. Las pantallas con métricas en vivo (gobierno, accesibilidad, motion) no se capturan.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'realsass-design-front', 'snapshots')
const NEW = path.join(DIR, '__nuevo__')

const [, , mode = 'check', ...rest] = process.argv
const opt = (n, d) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : d }
const BASE = opt('base', 'http://localhost:3026').replace(/\/$/, '')
const ONLY = opt('only')
const THRESHOLD = Number(opt('threshold', '0.002'))

const ROUTES = ['/', '/fundamentos', '/componentes', '/formularios', '/modales', '/avisos', '/estados', '/errores', '/graficos', '/login', '/temas', '/contenido']
const THEMES = ['light', 'dark']
const VIEWPORTS = [{ name: 'desktop', width: 1280, mobile: false }, { name: 'mobile', width: 390, mobile: true }]
const MAX_HEIGHT = 5000

const c = { r: (s) => `\x1b[31m${s}\x1b[0m`, g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m` }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const nameOf = (route, theme, vp) => `${route === '/' ? 'inicio' : route.slice(1)}__${theme}__${vp}.png`

// ── PNG: decodificación mínima (8 bits, RGB/RGBA, sin entrelazado: lo que entrega Chrome) ──
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9] }
    else if (type === 'IDAT') idat.push(data)
    p += 12 + len
  }
  const bpp = ct === 6 ? 4 : 3
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = Buffer.alloc(w * h * 4)
  let prev = Buffer.alloc(stride), pos = 0
  for (let y = 0; y < h; y++) {
    const f = raw[pos++]
    const line = Buffer.from(raw.subarray(pos, pos + stride)); pos += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], cc = i >= bpp ? prev[i - bpp] : 0
      if (f === 1) line[i] = (line[i] + a) & 255
      else if (f === 2) line[i] = (line[i] + b) & 255
      else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255
      else if (f === 4) { const pa = Math.abs(b - cc), pb = Math.abs(a - cc), pc = Math.abs(a + b - 2 * cc); line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc)) & 255 }
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, s = x * bpp; out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2]; out[o + 3] = bpp === 4 ? line[s + 3] : 255 }
    prev = line
  }
  return { w, h, data: out }
}

/** Fracción de píxeles que difieren (canal > 24) entre dos imágenes; 1 si el tamaño cambió. */
function diffRatio(a, b) {
  if (a.w !== b.w || a.h !== b.h) return 1
  let n = 0
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) > 24 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 24 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) n++
  }
  return n / (a.w * a.h)
}

// ── Chrome (CDP) ───────────────────────────────────────────────────────────────
function chromePath() {
  const cands = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']
  return cands.find((p) => p && fs.existsSync(p))
}

async function openBrowser() {
  const exe = chromePath()
  if (!exe) throw new Error('No encontré Chrome. Define CHROME_PATH.')
  const port = 9500 + Math.floor(Math.random() * 400)
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-snap-'))
  const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${dataDir}`, 'about:blank'], { stdio: 'ignore' })
  let ws
  for (let i = 0; i < 60 && !ws; i++) {
    try { ws = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl } catch { /* aún no */ }
    if (!ws) await sleep(250)
  }
  if (!ws) { proc.kill(); throw new Error('Chrome no respondió.') }
  const sock = new WebSocket(ws)
  await new Promise((r) => (sock.onopen = r))
  let id = 0
  const pending = new Map()
  sock.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } }
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })) })
  await send('Page.enable'); await send('Runtime.enable')
  return {
    send,
    close: async () => {
      try { sock.close() } catch { /* ya cerrado */ }
      proc.kill()
      await sleep(500)
      try { fs.rmSync(dataDir, { recursive: true, force: true }) } catch { /* en Windows Chrome puede retener archivos un momento: es una carpeta temporal */ }
    },
  }
}

async function shot(browser, route, theme, vp) {
  const { send } = browser
  await send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: 900, deviceScaleFactor: 1, mobile: vp.mobile })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
  await send('Page.navigate', { url: BASE + route })
  await sleep(2500)
  // Sin foco ni cursor encima, y fuentes cargadas: lo mismo en cada corrida.
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); return true })', awaitPromise: true })
  await sleep(400)
  const size = (await send('Page.getLayoutMetrics')).result.cssContentSize
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: vp.width, height: Math.min(Math.ceil(size.height), MAX_HEIGHT), scale: 1 } })
  return Buffer.from(r.result.data, 'base64')
}

// ── principal ──────────────────────────────────────────────────────────────────
async function main() {
  if (!['update', 'check'].includes(mode)) { console.log('Usa: update | check'); process.exit(2) }
  try { await fetch(BASE, { signal: AbortSignal.timeout(5000) }) } catch {
    console.log(c.r(`\nNo se puede abrir ${BASE}. Levanta el taller:  pnpm --filter realsass-design-front dev\n`)); process.exit(2)
  }
  const jobs = ROUTES.flatMap((r) => THEMES.flatMap((t) => VIEWPORTS.map((v) => ({ route: r, theme: t, vp: v, file: nameOf(r, t, v.name) })))).filter((j) => !ONLY || j.file.includes(ONLY))
  fs.mkdirSync(DIR, { recursive: true })
  if (mode === 'check') fs.rmSync(NEW, { recursive: true, force: true })

  console.log(c.b(`\nUI · capturas (${mode === 'update' ? 'actualizar línea base' : 'comparar con la línea base'}) · ${jobs.length} pantallas\n`))
  const browser = await openBrowser()
  const changed = [], missing = []
  try {
    for (const j of jobs) {
      const png = await shot(browser, j.route, j.theme, j.vp)
      const target = path.join(DIR, j.file)
      if (mode === 'update') { fs.writeFileSync(target, png); console.log(`  ${c.g('✓')} ${j.file} ${c.d(`${(png.length / 1024).toFixed(0)} KB`)}`); continue }
      if (!fs.existsSync(target)) { missing.push(j.file); console.log(`  ${c.y('?')} ${j.file} ${c.d('sin línea base')}`); continue }
      const ratio = diffRatio(decodePng(fs.readFileSync(target)), decodePng(png))
      if (ratio > THRESHOLD) {
        fs.mkdirSync(NEW, { recursive: true }); fs.writeFileSync(path.join(NEW, j.file), png)
        changed.push([j.file, ratio]); console.log(`  ${c.r('✗')} ${j.file} ${c.d(`${(ratio * 100).toFixed(2)} % de píxeles distintos`)}`)
      } else console.log(`  ${c.g('✓')} ${j.file} ${c.d(`${(ratio * 100).toFixed(3)} %`)}`)
    }
  } finally { await browser.close() }

  if (mode === 'update') { console.log(c.g(`\n✓ Línea base actualizada en ${path.relative(ROOT, DIR)}.\n`)); return }
  console.log()
  if (missing.length) console.log(c.y(`  ${missing.length} pantallas sin línea base: ejecuta  pnpm ui:snap\n`))
  if (changed.length) {
    console.log(c.r(`✗ ${changed.length} pantallas cambiaron de aspecto. Las nuevas están en ${path.relative(ROOT, NEW)}/ para compararlas con la línea base.`))
    console.log(c.d('  Si el cambio es intencional:  pnpm ui:snap  (y commitea las imágenes). Si no, es una regresión.\n'))
    process.exit(1)
  }
  console.log(c.g('✓ Ninguna pantalla cambió de aspecto.\n'))
  if (missing.length) process.exit(1)
}

main().catch((e) => { console.error(c.r(`\n${e.message}\n`)); process.exit(2) })
