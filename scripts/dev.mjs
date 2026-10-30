#!/usr/bin/env node
/**
 * pnpm dev — levanta todo el ecosistema en local, en orden.
 *
 *   0. Contratos: si falta packages/trpc/dist corre `pnpm contracts` (los backs y fronts lo necesitan).
 *   1. Backs (sass-back :3020, ecommerce-back :3025) y se espera a que cada uno abra su puerto.
 *   2. Fronts (sass-front :3021, dashboard :3022, storefront :3023), de a uno y con una pausa entre cada uno.
 *
 * Por qué en orden: los fronts renderizan en el servidor y llaman a los backs; si arrancan antes de que
 * Nest termine de compilar (~15–20 s) fallan con `fetch failed` / ECONNREFUSED.
 *
 * Si un puerto ya está en uso se asume que ese servicio ya corre y se lo saltea (no se lo mata).
 * Ctrl+C cierra todo lo que levantó este script.
 *
 * Variables: DEV_ONLY=sass-back,sass-front  → levanta solo esos servicios (por nombre corto).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root  = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

const SERVICES = [
  { key: 'sass-back',      pkg: 'realsass-sass-back',        port: 3020, kind: 'back',  color: 34 },
  { key: 'ecommerce-back', pkg: 'realsass-ecommerce-back',   port: 3025, kind: 'back',  color: 36 },
  { key: 'sass-front',     pkg: 'realsass-sass-front',       port: 3021, kind: 'front', color: 32 },
  { key: 'dashboard',      pkg: 'realsass-dashboard-front',  port: 3022, kind: 'front', color: 35 },
  { key: 'storefront',     pkg: 'real-ecommerce-front',      port: 3023, kind: 'front', color: 33 },
  { key: 'docs',           pkg: 'realsass-docs-front',       port: 3024, kind: 'front', color: 31 },
  { key: 'design',         pkg: 'realsass-design-front',      port: 3026, kind: 'front', color: 35 },
];

const only = process.env.DEV_ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
const selected = SERVICES.filter((s) => !only || only.includes(s.key));
const WAIT_BACK_MS = 150_000;

const tag = (s) => `\x1b[${s.color}m${s.key.padEnd(14)}\x1b[0m │ `;
const say = (msg) => console.log(`\x1b[1m[dev]\x1b[0m ${msg}`);

/** true si algo ya escucha en el puerto (IPv4 o IPv6). */
function portOpen(port, host = '127.0.0.1', timeout = 800) {
  return new Promise((done) => {
    const sock = net.connect({ port, host });
    const finish = (ok) => { sock.destroy(); done(ok); };
    sock.setTimeout(timeout, () => finish(false));
    sock.once('connect', () => finish(true));
    sock.once('error', () => finish(false));
  });
}
const listening = async (port) => (await portOpen(port)) || (await portOpen(port, '::1'));

async function waitForPort(svc, deadline) {
  while (Date.now() < deadline) {
    if (await listening(svc.port)) return true;
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

const children = [];

function killTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch { /* ya terminó */ }
}

function shutdown(code = 0) {
  if (children.length) say('cerrando servicios…');
  children.forEach(killTree);
  process.exit(code);
}
process.on('SIGINT',  () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function start(svc) {
  const child = spawn('pnpm', ['--filter', svc.pkg, 'dev'], {
    cwd: root,
    shell: isWin,              // pnpm es un .cmd en Windows
    detached: !isWin,          // grupo propio para poder cerrar el árbol
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);

  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) out.write(`${tag(svc)}${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code, signal) => {
    if (signal || code === 0) return;
    say(`\x1b[31m${svc.key} terminó con código ${code}\x1b[0m (el resto sigue corriendo)`);
  });
  return child;
}

const STAGGER_MS = 4_000;

/** `stagger`: espera a que cada servicio abra su puerto y deja respirar unos segundos antes del siguiente. */
async function launch(list, stagger = false) {
  const started = [];
  for (const svc of list) {
    if (await listening(svc.port)) {
      say(`${svc.key}: el puerto :${svc.port} ya está en uso → se asume que ya corre, no se vuelve a levantar`);
      continue;
    }
    say(`levantando ${svc.key} (:${svc.port})`);
    start(svc);
    started.push(svc);
    if (stagger) {
      await waitForPort(svc, Date.now() + 60_000);
      await new Promise((r) => setTimeout(r, STAGGER_MS));
    }
  }
  return started;
}

// ── 0. Contratos ──────────────────────────────────────────────────────────────
if (!existsSync(join(root, 'packages', 'trpc', 'dist', 'index.js'))) {
  say('falta packages/trpc/dist → corriendo `pnpm contracts` (una sola vez)…');
  const res = spawnSync('pnpm', ['contracts'], { cwd: root, shell: isWin, stdio: 'inherit' });
  if (res.status !== 0) { say('\x1b[31mfalló `pnpm contracts`; revisá el error de arriba\x1b[0m'); process.exit(1); }
}

// ── 1. Backs ──────────────────────────────────────────────────────────────────
const backs = selected.filter((s) => s.kind === 'back');
const fronts = selected.filter((s) => s.kind === 'front');

const startedBacks = await launch(backs);
if (backs.length) {
  const deadline = Date.now() + WAIT_BACK_MS;
  for (const svc of backs) {
    process.stdout.write('');
    const ok = await waitForPort(svc, deadline);
    say(ok ? `\x1b[32m✓ ${svc.key} listo en :${svc.port}\x1b[0m`
           : `\x1b[33m⚠ ${svc.key} no abrió :${svc.port} en ${WAIT_BACK_MS / 1000} s; sigo igual\x1b[0m`);
  }
}

// ── 2. Fronts ─────────────────────────────────────────────────────────────────
// Uno por vez: tres `next dev` compilando a la vez + los typecheckers de Nest saturan Windows y Turbopack
// puede fallar al lanzar PostCSS ("node process exited ... 0xc0000142").
const startedFronts = await launch(fronts, true);

if (startedBacks.length + startedFronts.length === 0) {
  say('no hay nada para levantar: todos los puertos ya estaban en uso.');
  process.exit(0);
}

say('todo en marcha. URLs:');
for (const s of selected) say(`  ${s.key.padEnd(14)} http://localhost:${s.port}`);
say('Ctrl+C cierra todo lo que levantó este comando.');
