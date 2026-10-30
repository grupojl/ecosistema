#!/usr/bin/env node
/**
 * check-env — verifica las variables de entorno de un servicio (camino a producción, punto 4).
 *
 *   node scripts/check-env.mjs                      → ESTÁTICO: toda variable que el código lee debe estar documentada en su .env.example
 *   node scripts/check-env.mjs --service realsass-sass-back --env-file ruta/.env.production
 *                                                    → VALIDA un archivo de entorno real: faltantes, placeholders y formatos
 *
 * El .env.example marca cada variable con [REQUERIDA] u [OPCIONAL]; ese comentario es la fuente de verdad de lo obligatorio.
 * Nunca imprime valores, solo nombres y el motivo del problema.
 */
import { createPrivateKey } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const SERVICES = [
  'realsass-sass-back',
  'realsass-ecommerce-back',
  'realsass-sass-front',
  'realsass-dashboard-front',
  'real-ecommerce-front',
];

/** Variables del sistema / de plataforma: no se documentan en el .env.example. */
const IGNORE = new Set([
  'NODE_ENV', 'CI', 'HOSTNAME', 'NEXT_RUNTIME', 'NEXT_PHASE', 'NEXT_TELEMETRY_DISABLED', 'VERCEL', 'VERCEL_ENV', 'VERCEL_URL',
  'RAILWAY_GIT_COMMIT_SHA', 'RAILWAY_ENVIRONMENT', 'RAILWAY_PUBLIC_DOMAIN', 'RAILWAY_STATIC_URL', 'npm_package_version', 'ANALYZE', 'PWD', 'HOME', 'PATH',
  'RUN_DB_TESTS', 'TEMP', 'TMP',
]);

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'generated', '.turbo', 'coverage', '__tests__']);
const SOURCE = /\.(ts|tsx|js|mjs|cjs)$/;
const SPEC = /\.(spec|test|e2e-spec)\.(ts|tsx)$/;

function parseExample(file) {
  const documented = new Set();
  const required = new Set();
  let nextIsRequired = false;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('#')) {
      if (line.includes('[REQUERIDA]') || line.includes('[REQUERIDO]')) nextIsRequired = true;
      const commented = /^#\s*([A-Z][A-Z0-9_]+)=/.exec(line);
      if (commented) documented.add(commented[1]);
      continue;
    }
    const m = /^([A-Z][A-Z0-9_]+)=/.exec(line);
    if (m) {
      documented.add(m[1]);
      if (nextIsRequired) required.add(m[1]);
      nextIsRequired = false;
    } else if (line === '') {
      // una línea en blanco corta la asociación entre el comentario y la variable
      nextIsRequired = false;
    }
  }
  return { documented, required };
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (SOURCE.test(name) && !SPEC.test(name)) yield full;
  }
}

function usedVariables(serviceDir) {
  const used = new Map();
  const patterns = [
    /process\.env(?:\.([A-Z][A-Z0-9_]+)|\[\s*['"]([A-Z][A-Z0-9_]+)['"]\s*\])/g,
    /(?:getOrThrow|\.get)(?:<[^>]*>)?\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g,
  ];
  for (const file of walk(serviceDir)) {
    const text = readFileSync(file, 'utf8');
    for (const re of patterns) {
      for (const m of text.matchAll(re)) {
        const name = m[1] ?? m[2];
        if (!name || IGNORE.has(name)) continue;
        // `.get('X')` también existe en Map/Headers/Cookies: solo cuenta si el nombre parece una variable de entorno (con guion bajo)
        if (re === patterns[1] && !name.includes('_')) continue;
        if (!used.has(name)) used.set(name, file.replace(serviceDir, '').replace(/\\/g, '/'));
      }
    }
  }
  return used;
}

function parseEnvFile(file) {
  const env = new Map();
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(raw);
    if (!m) continue;
    let v = m[2].trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    env.set(m[1], v);
  }
  return env;
}

const PLACEHOLDER = /<COMPLETAR>|^changeme$|^xxx+$|^tu-|^your[-_]|^example$/i;

/** Reglas de formato específicas (sin imprimir valores). */
function formatProblems(env) {
  const out = [];
  const key = env.get('CONFIG_MASTER_KEY');
  if (key !== undefined && !/^[0-9a-fA-F]{64}$/.test(key)) out.push(['CONFIG_MASTER_KEY', 'debe ser 32 bytes en hex (64 caracteres)']);
  const internal = env.get('INTERNAL_API_KEY');
  if (internal !== undefined && internal.length < 24) out.push(['INTERNAL_API_KEY', 'demasiado corta (usar ≥ 24 caracteres aleatorios)']);
  const pk = env.get('FIREBASE_PRIVATE_KEY');
  if (pk !== undefined) {
    // Misma normalización que packages/auth-server/src/firebase/firebase.module.ts
    const pem = pk.replace(/\\+(?:n|\r?\n)/g, '\n');
    try { createPrivateKey(pem); } catch { out.push(['FIREBASE_PRIVATE_KEY', 'no se puede leer como clave privada PEM (revisar el escape de los saltos de línea)']); }
  }
  for (const [name, value] of env) {
    if (/_URL$/.test(name) && value && /localhost|127\.0\.0\.1/.test(value)) out.push([name, 'apunta a localhost (¿es un archivo de producción?)']);
  }
  const domain = env.get('COOKIE_DOMAIN');
  if (domain !== undefined && domain !== '' && !domain.startsWith('.')) out.push(['COOKIE_DOMAIN', 'normalmente empieza con punto (.midominio.com) para compartirse entre subdominios']);
  if (env.get('NODE_ENV') && env.get('NODE_ENV') !== 'production') out.push(['NODE_ENV', 'no es "production"']);
  return out;
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const service = arg('service');
const envFile = arg('env-file');
let failed = false;

if (envFile) {
  if (!service || !SERVICES.includes(service)) {
    console.error(`Uso: --service <${SERVICES.join('|')}> --env-file <archivo>`);
    process.exit(2);
  }
  const { required } = parseExample(join(ROOT, service, '.env.example'));
  const env = parseEnvFile(envFile);
  const missing = [...required].filter((k) => !env.has(k) || env.get(k) === '');
  const placeholders = [...required].filter((k) => env.has(k) && PLACEHOLDER.test(env.get(k)));
  const formats = formatProblems(env);
  console.log(`\n${service} ← ${envFile}\n  requeridas: ${required.size} · definidas: ${env.size}`);
  for (const k of missing) console.log(`  ✖ falta        ${k}`);
  for (const k of placeholders) console.log(`  ✖ placeholder  ${k}`);
  for (const [k, why] of formats) console.log(`  ⚠ ${k}: ${why}`);
  failed = missing.length > 0 || placeholders.length > 0 || formats.some(([k]) => k !== 'NODE_ENV' && k !== 'COOKIE_DOMAIN');
  if (!failed && formats.length === 0) console.log('  ✔ sin problemas');
} else {
  for (const s of service ? [service] : SERVICES) {
    const example = join(ROOT, s, '.env.example');
    if (!existsSync(example)) { console.log(`\n${s}: sin .env.example`); failed = true; continue; }
    const { documented } = parseExample(example);
    const undocumented = [...usedVariables(join(ROOT, s))].filter(([name]) => !documented.has(name));
    console.log(`\n${s}: ${documented.size} documentadas`);
    for (const [name, where] of undocumented) console.log(`  ✖ el código lee ${name} (${where}) y no está en .env.example`);
    if (undocumented.length === 0) console.log('  ✔ todo lo que el código lee está documentado');
    else failed = true;
  }
}

process.exit(failed ? 1 : 0);
