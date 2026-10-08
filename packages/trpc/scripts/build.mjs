/**
 * Build de @real/trpc — genera dist/ autocontenido para los consumidores.
 *
 *   1. core        → dist/markets, dist/server   (sin dependencias de los backs)
 *   2. contratos   → dist/contracts/<back>/      (.d.ts de cada back, emitidos con
 *                    el tsconfig de ese back; los alias @/ se reescriben a relativos)
 *   3. paquete     → dist/index (.js + .d.ts) que re-exporta todo
 *
 * Requisito: `prisma generate` ya corrido en ambos backs (los services tipan con
 * @prisma/client). Los backs importan solo `@real/trpc/markets` (paso 1), por eso
 * no hay ciclo aunque el paso 2 lea el código de los backs.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts   = require('typescript');
const tsc  = require.resolve('typescript/bin/tsc');
const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(here, '..', '..');
const dist = join(here, 'dist');

const BACKS = [
  { key: 'sass-back',      dir: join(root, 'realsass-sass-back') },
  { key: 'ecommerce-back', dir: join(root, 'realsass-ecommerce-back') },
];

const runTsc = (args, cwd = here) =>
  execFileSync(process.execPath, [tsc, ...args], { cwd, stdio: 'inherit' });

const posix = (p) => p.split(sep).join('/');
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

/**
 * tsconfig de emisión de un back: hereda el tsconfig del back (alias @/ propios),
 * mapea los packages internos a su fuente para que también se emitan sus .d.ts,
 * y emite solo declaraciones desde el entry types-for-frontend.
 */
function writeTypesConfig(back, outDir) {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    join(back.dir, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  );
  const cfgPath = join(dist, '.tmp', `tsconfig.${back.key}.json`);
  mkdirSync(dirname(cfgPath), { recursive: true });
  writeFileSync(cfgPath, JSON.stringify({
    extends: join(back.dir, 'tsconfig.json'),
    compilerOptions: {
      noEmit: false, emitDeclarationOnly: true, declaration: true, sourceMap: false,
      incremental: false, rootDir: root, outDir, baseUrl: back.dir,
      paths: { ...(parsed?.options.paths ?? {}), '@real/auth-server': ['../packages/auth-server/src/index.ts'] },
    },
    include: [],
    exclude: [],
    files: [join(back.dir, 'src/trpc/types-for-frontend.ts')],
  }, null, 2));
  return cfgPath;
}

/**
 * El cliente de Prisma ya viene generado como .d.ts (src/generated/prisma): tsc no lo
 * re-emite, así que se copia al espejo para que los tipos de los services (enums, JSON)
 * lleguen al front sin depender de @prisma/client.
 */
function copyGeneratedDeclarations(back, outDir) {
  const src = join(back.dir, 'src', 'generated');
  for (const file of walk(src).filter((f) => f.endsWith('.d.ts'))) {
    const target = join(outDir, relative(root, file));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
  }
}

/** Reescribe specifiers con alias (@/…, paths del tsconfig) a rutas relativas dentro de outDir. */
function rewriteAliases(cfgPath, back, outDir) {
  const { options } = ts.getParsedCommandLineOfConfigFile(
    cfgPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  );
  const SPEC = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\2/g;
  let rewritten = 0;

  for (const file of walk(outDir).filter((f) => f.endsWith('.d.ts'))) {
    const source = join(root, relative(outDir, file)).replace(/\.d\.ts$/, '.ts');
    const text = readFileSync(file, 'utf8');
    const next = text.replace(SPEC, (m, pre, q, spec) => {
      if (spec.startsWith('.')) return m;
      const hit = ts.resolveModuleName(spec, source, options, ts.sys).resolvedModule;
      if (!hit || hit.isExternalLibraryImport) return m;
      const generated = hit.resolvedFileName.includes(`${sep}src${sep}generated${sep}`) || hit.resolvedFileName.includes('/src/generated/');
      if (hit.resolvedFileName.endsWith('.d.ts') && !generated) return m;
      if (hit.resolvedFileName.includes(`${sep}node_modules${sep}`)) return m;
      const target = join(outDir, relative(root, hit.resolvedFileName)).replace(/\.tsx?$/, '');
      let rel = posix(relative(dirname(file), target));
      if (!rel.startsWith('.')) rel = `./${rel}`;
      rewritten++;
      return `${pre}${q}${rel}${q}`;
    });
    if (next !== text) writeFileSync(file, next);
  }
  console.log(`[@real/trpc] ${back.key}: ${rewritten} alias reescritos`);
}

rmSync(dist, { recursive: true, force: true });

console.log('[@real/trpc] 1/3 core');
runTsc(['-p', 'tsconfig.core.json']);

console.log('[@real/trpc] 2/3 contratos de los backs');
for (const back of BACKS) {
  const outDir = join(dist, 'contracts', back.key);
  const cfgPath = writeTypesConfig(back, outDir);
  runTsc(['-p', cfgPath], back.dir);
  copyGeneratedDeclarations(back, outDir);
  rewriteAliases(cfgPath, back, outDir);
}

rmSync(join(dist, '.tmp'), { recursive: true, force: true });

console.log('[@real/trpc] 3/3 paquete');
runTsc(['-p', 'tsconfig.build.json']);
console.log('[@real/trpc] ok');
