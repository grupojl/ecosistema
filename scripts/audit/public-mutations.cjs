#!/usr/bin/env node
/**
 * public-mutations.cjs — S10 (ADR-023 / ADR-027)
 *
 * Lista las MUTACIONES tRPC declaradas con `publicProcedure` (sin sesión) en los routers de ambos backs y las compara
 * con scripts/audit/public-mutations.allowlist. Una mutación pública nueva es una decisión de seguridad: tiene que
 * agregarse a la lista a propósito, con su motivo. Es la clase de bug de markets.create/update/delete, que durante un
 * tiempo estuvieron públicas y aceptaban la organización por input.
 *
 * Uso: node scripts/audit/public-mutations.cjs [--print]   (sale con 1 si hay una mutación pública fuera de la lista)
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKS = ['realsass-sass-back', 'realsass-ecommerce-back'];
const ALLOWLIST = path.join(__dirname, 'public-mutations.allowlist');

function routers(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.router.ts')).map((f) => path.join(dir, f));
}

/** Devuelve [{ name, procedure }] de las mutaciones cuyo builder es publicProcedure. */
function publicMutations(file) {
  const src = fs.readFileSync(file, 'utf8');
  const found = [];
  // `nombre: <builder> ... .mutation(`  — el builder es lo primero tras "nombre:"
  const re = /(\w+):\s*(publicProcedure|authProcedure|tenantProcedure|ownerProcedure|internalProcedure|adminProcedure|ownerOnlyProcedure|customerProcedure)\b([\s\S]*?)(?=\n\s{2,8}\w+:\s*(?:publicProcedure|authProcedure|tenantProcedure|ownerProcedure|internalProcedure|adminProcedure|ownerOnlyProcedure|customerProcedure|router)\b|\n\s*}\)\s*[;,)]?\s*$)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[2] === 'publicProcedure' && /\.mutation\(/.test(m[3])) found.push(m[1]);
  }
  return found;
}

const current = [];
for (const back of BACKS) {
  for (const file of routers(path.join(ROOT, back, 'src', 'trpc', 'routers'))) {
    for (const name of publicMutations(file)) {
      current.push(`${back}:${path.basename(file, '.router.ts')}.${name}`);
    }
  }
}
current.sort();

if (process.argv.includes('--print')) {
  console.log(current.join('\n'));
  process.exit(0);
}

const allowed = new Set(
  fs.existsSync(ALLOWLIST)
    ? fs.readFileSync(ALLOWLIST, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
    : [],
);
const unexpected = current.filter((c) => !allowed.has(c));
const stale = [...allowed].filter((a) => !current.includes(a));

for (const u of unexpected) console.log(`     → mutación PÚBLICA fuera de la lista: ${u}`);
for (const s of stale) console.log(`     → en la lista pero ya no existe (borrala): ${s}`);
process.exit(unexpected.length + stale.length === 0 ? 0 : 1);
