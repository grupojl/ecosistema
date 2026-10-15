#!/usr/bin/env node
// Dependencias fantasma (ADR-018): todo import externo debe estar declarado
// en el package.json del workspace que lo usa. Sin esto, el código solo
// funciona por el hoisting de node_modules y rompe en Docker / pnpm deploy.
//
//   node scripts/audit/phantom-deps.cjs          → imprime hallazgos, exit 1 si hay
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKSPACES = [
  'realsass-sass-back', 'realsass-ecommerce-back',
  'realsass-sass-front', 'realsass-dashboard-front', 'real-ecommerce-front', 'realsass-docs-front',
  'packages/auth-client', 'packages/auth-server', 'packages/trpc', 'packages/ui',
];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', 'test', '__tests__', 'scripts', '.turbo']);
const SKIP_FILE = /\.(spec|test|e2e-spec)\.[tj]sx?$|\.d\.ts$/;
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else if (/\.[cm]?[tj]sx?$/.test(entry.name) && !SKIP_FILE.test(entry.name)) {
      yield path.join(dir, entry.name);
    }
  }
}

function pkgName(spec) {
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || spec.startsWith('~') || spec.startsWith('#')) return null;
  if (BUILTINS.has(spec) || BUILTINS.has(spec.split('/')[0])) return null;
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

let findings = 0;
for (const ws of WORKSPACES) {
  const dir = path.join(ROOT, ws);
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const declared = new Set([
    ...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}), ...Object.keys(pkg.optionalDependencies || {}),
    pkg.name,
  ]);
  const has = (n) => declared.has(n) || declared.has('@types/' + n.replace(/^@/, '').replace('/', '__'));
  const missing = new Map();
  for (const file of walk(dir)) {
    const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of src.matchAll(IMPORT_RE)) {
      const name = pkgName(m[1]);
      if (name && !has(name)) (missing.get(name) || missing.set(name, new Set()).get(name)).add(path.relative(dir, file).split(path.sep).join('/'));
    }
  }
  for (const [name, files] of [...missing].sort()) {
    findings++;
    console.log(`  ❌ ${ws}: importa "${name}" sin declararlo (${[...files].slice(0, 2).join(', ')}${files.size > 2 ? ` +${files.size - 2}` : ''})`);
  }
}
if (findings === 0) console.log('  ✅ Sin dependencias fantasma en ningún workspace');
process.exit(findings === 0 ? 0 : 1);
