#!/usr/bin/env node
/**
 * check-type-safety — guardia del norte de tipos (ADR-019 + ADR-030): nada de `any` ni de aserciones de tipo inseguras.
 *
 *   node scripts/check-type-safety.mjs            → resumen por categoría y archivo
 *   node scripts/check-type-safety.mjs --check    → falla si hay algo NUEVO sin justificar (lo usa el CI)
 *   node scripts/check-type-safety.mjs --update   → reescribe la línea base (solo al BAJAR; nunca para esconder deuda)
 *
 * Usa la API de TypeScript (no regex): ve `as any`, `as unknown as X`, `as never`, `as Tipo`, `<Tipo>x`, `: any`, `!`,
 * `@ts-ignore` y `@ts-nocheck`. Ignora tests, código generado y `as const`.
 *
 * Un cast legítimo lleva el marcador `// @real/cast:<tipo> motivo` en su línea o en la anterior (ver
 * .claude/conventions/type-safety.md). Con marcador cuenta como "justificado" y no rompe el CI.
 *
 * Línea base (`scripts/type-safety.baseline.json`): deuda existente por archivo y categoría. El CI exige que NUNCA
 * aumente; bajarla es el objetivo. Las categorías "duras" (any, as-any, as-never, ts-ignore) no admiten entradas nuevas.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(root, 'scripts', 'type-safety.baseline.json');

const ROOTS = [
  'realsass-sass-back/src',
  'realsass-sass-front',
  'realsass-dashboard-front',
  'realsass-design-front',
  'realsass-docs-front',
  'packages/auth-client/src',
  'packages/auth-server/src',
  'packages/i18n/src',
  'packages/ui/src',
  'packages/trpc/src',
];
const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'generated', 'coverage', '.turbo', 'test-results', 'playwright-report', '__tests__', 'test']);
const SKIP_FILE = /(\.(spec|test|e2e-spec)\.(ts|tsx)|\.d\.ts|vitest\.setup\.ts|\.bak\d*|\.config\.(ts|js|mjs))$/;
const MARKER = /@real\/cast:[a-z-]+/;
/** Categorías que no admiten NINGUNA entrada nueva (ni siquiera aumentando la línea base de un archivo con deuda). */
const HARD = new Set(['any', 'as-any', 'as-never', 'ts-ignore']);

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) return SKIP_DIR.has(n) ? [] : walk(p);
    return /\.(ts|tsx)$/.test(n) && !SKIP_FILE.test(n) ? [p] : [];
  });

function analyze(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = [];
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
  const justified = (line) => MARKER.test(lines[line] ?? '') || MARKER.test(lines[line - 1] ?? '');
  const add = (kind, node) => {
    const line = lineOf(node);
    found.push({ kind, line: line + 1, marked: justified(line), code: (lines[line] ?? '').trim().slice(0, 120) });
  };
  const isUnknown = (t) => t?.kind === ts.SyntaxKind.UnknownKeyword;

  (function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) add('any', node);
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      const type = node.type;
      const isConst = ts.isTypeReferenceNode(type) && type.typeName.getText(sf) === 'const';
      if (!isConst) {
        const inner = ts.isAsExpression(node) ? node.expression : null;
        if (type.kind === ts.SyntaxKind.AnyKeyword) add('as-any', node);
        else if (type.kind === ts.SyntaxKind.NeverKeyword) add('as-never', node);
        else if (inner && ts.isAsExpression(inner) && isUnknown(inner.type)) add('as-unknown-as', node);
        else if (!isUnknown(type)) add('as-type', node);
      }
    }
    if (ts.isNonNullExpression(node)) add('non-null', node);
    ts.forEachChild(node, visit);
  })(sf);

  // @ts-ignore / @ts-nocheck (los @ts-expect-error con motivo están bien)
  lines.forEach((l, i) => {
    if (/@ts-(ignore|nocheck)\b/.test(l)) found.push({ kind: 'ts-ignore', line: i + 1, marked: MARKER.test(l), code: l.trim().slice(0, 120) });
  });
  return found;
}

const files = ROOTS.map((r) => join(root, r)).filter(existsSync).flatMap(walk);
/** { categoría: { archivo: { total, unmarked } } } */
const result = {};
const detail = [];
for (const file of files) {
  const rel = relative(root, file).split(sep).join('/');
  for (const f of analyze(file)) {
    const entry = ((result[f.kind] ??= {})[rel] ??= { total: 0, unmarked: 0 });
    entry.total++;
    if (!f.marked) entry.unmarked++;
    detail.push({ file: rel, ...f });
  }
}

const sum = (cat, key) => Object.values(result[cat] ?? {}).reduce((a, e) => a + e[key], 0);
const CATS = ['any', 'as-any', 'as-never', 'as-unknown-as', 'as-type', 'non-null', 'ts-ignore'];

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(detail, null, 2));
  process.exit(0);
}

if (process.argv.includes('--update')) {
  const base = Object.fromEntries(CATS.map((c) => [c, Object.fromEntries(Object.entries(result[c] ?? {}).filter(([, e]) => e.unmarked > 0).map(([f, e]) => [f, e.unmarked]))]));
  writeFileSync(BASELINE, JSON.stringify(base, null, 2) + '\n');
  console.log(`[type-safety] línea base escrita: ${BASELINE}`);
  process.exit(0);
}

if (process.argv.includes('--check')) {
  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  const errors = [];
  for (const cat of CATS) {
    for (const [file, e] of Object.entries(result[cat] ?? {})) {
      const allowed = base[cat]?.[file] ?? 0;
      if (e.unmarked > allowed) {
        const hard = HARD.has(cat) ? ' [categoría dura: no admite nuevos]' : '';
        errors.push(`${file}: ${e.unmarked} ${cat} sin justificar (línea base: ${allowed})${hard}`);
        for (const d of detail.filter((x) => x.file === file && x.kind === cat && !x.marked)) errors.push(`    L${d.line}: ${d.code}`);
      }
    }
  }
  const improved = CATS.reduce((n, c) => n + Object.entries(base[c] ?? {}).filter(([f, a]) => (result[c]?.[f]?.unmarked ?? 0) < a).length, 0);
  if (errors.length) {
    console.error('[type-safety] ✘ hay tipos inseguros NUEVOS. Tipalos de verdad o, si es un borde externo legítimo, marcalo con `// @real/cast:<tipo> motivo`.\n');
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`[type-safety] ✔ sin tipos inseguros nuevos${improved ? ` (${improved} archivo(s) mejoraron: corré --update para bajar la línea base)` : ''}`);
  process.exit(0);
}

console.log(`Archivos analizados: ${files.length}\n`);
console.log('categoría'.padEnd(16), 'sin justificar'.padStart(15), 'justificados'.padStart(13));
for (const c of CATS) console.log(c.padEnd(16), String(sum(c, 'unmarked')).padStart(15), String(sum(c, 'total') - sum(c, 'unmarked')).padStart(13));
for (const c of CATS) {
  const rows = Object.entries(result[c] ?? {}).filter(([, e]) => e.unmarked > 0).sort((a, b) => b[1].unmarked - a[1].unmarked);
  if (!rows.length) continue;
  console.log(`\n── ${c} (${rows.length} archivos)`);
  for (const [f, e] of rows.slice(0, 40)) console.log(`  ${String(e.unmarked).padStart(3)}  ${f}`);
}
