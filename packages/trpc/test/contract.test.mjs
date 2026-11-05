/**
 * Test de contrato de @real/trpc (DT-TEST-08, ADR-019). Corre con el runner nativo de Node: `node --test test/`.
 *
 * Detecta lo que vacía el tipado extremo a extremo sin que nada falle en compilación:
 *   1. dist ausente o incompleto
 *   2. dist DESFASADO respecto de los routers de los backs (alguien cambió un router y no corrió el build)
 *   3. procedures / inputs / outputs tipados como `any`
 *   4. alias `@/` sin reescribir en los .d.ts (el front no los resuelve)
 * Requiere `pnpm contracts` previo (el mismo orden que el CI: prisma generate → @real/trpc build → tests).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(here, '..', '..');
const dist = join(here, 'dist');
const posix = (p) => p.split(sep).join('/');
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** Misma huella que scripts/build.mjs (si se cambia allá, cambiarla acá). */
function contractFingerprint() {
  const h = createHash('sha256');
  for (const back of ['realsass-sass-back']) {
    const dir = join(root, back, 'src', 'trpc');
    for (const f of walk(dir).filter((p) => p.endsWith('.ts') && !p.endsWith('.spec.ts')).sort()) {
      h.update(posix(relative(root, f)));
      h.update(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
    }
  }
  return h.digest('hex');
}

const HINT = 'Corré `pnpm contracts` (prisma generate del back + pnpm --filter @real/trpc build).';

describe('dist de @real/trpc', () => {
  it('existe y expone el contrato', () => {
    for (const f of ['index.d.ts', 'index.js', 'markets.d.ts', 'router-types.d.ts', 'build-info.json']) {
      assert.ok(existsSync(join(dist, f)), `Falta dist/${f}. ${HINT}`);
    }
    const types = readFileSync(join(dist, 'router-types.d.ts'), 'utf8');
    assert.match(types, /sass-back/);
    for (const back of ['sass-back']) {
      const entry = readdirSync(join(dist, 'contracts', back)).length;
      assert.ok(entry > 0, `dist/contracts/${back} está vacío`);
    }
  });

  it('no está desfasado respecto de los routers de los backs', () => {
    const built = JSON.parse(readFileSync(join(dist, 'build-info.json'), 'utf8')).contractFingerprint;
    assert.equal(built, contractFingerprint(), `dist está desfasado: cambió algún router de src/trpc. ${HINT}`);
  });

  it('ningún .d.ts conserva alias "@/" sin reescribir', () => {
    const offenders = walk(join(dist, 'contracts'))
      .filter((f) => f.endsWith('.d.ts'))
      .filter((f) => /from\s+['"]@\//.test(readFileSync(f, 'utf8')))
      .map((f) => relative(dist, f));
    assert.deepEqual(offenders, [], 'Alias @/ sin reescribir (el front no los resuelve)');
  });
});

describe('tipos del contrato (sin `any`)', () => {
  const probe = join(here, 'test', '__probe.ts');
  after(() => rmSync(probe, { force: true }));

  const PROBE = `
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { SassAppRouter } from '../dist/index';

type IsAny<T> = 0 extends 1 & T ? true : false;
type Procs<R> = R extends { _def: { procedures: infer P } } ? P : never;
/** Paths de procedures cuyo tipo es any. */
type AnyProcs<R> = { [K in keyof Procs<R>]: IsAny<Procs<R>[K]> extends true ? K : never }[keyof Procs<R>];
/** Namespaces/procedures (hasta 2 niveles) con input u output any. */
type AnyAt<T> = {
  [A in keyof T & string]: IsAny<T[A]> extends true ? A : {
    [B in keyof T[A] & string]: IsAny<T[A][B]> extends true ? \`\${A}.\${B}\` : never;
  }[keyof T[A] & string];
}[keyof T & string];
/** Las claves del mapa de procedures deben ser literales: si son 'string' el router perdió su tipo. */
type LiteralKeys<R> = string extends keyof Procs<R> ? false : true;

// Control negativo: el detector tiene que ver un any cuando lo hay.
export const detectorWorks: AnyProcs<{ _def: { procedures: { x: any; y: 1 } } }> extends 'x' ? true : false = true;

export const sassKeys: LiteralKeys<SassAppRouter> = true;
export const sassProcs: [AnyProcs<SassAppRouter>] extends [never] ? true : AnyProcs<SassAppRouter> = true;
export const sassIn: [AnyAt<inferRouterInputs<SassAppRouter>>] extends [never] ? true : AnyAt<inferRouterInputs<SassAppRouter>> = true;
export const sassOut: [AnyAt<inferRouterOutputs<SassAppRouter>>] extends [never] ? true : AnyAt<inferRouterOutputs<SassAppRouter>> = true;
`;

  it('SassAppRouter conserva procedures, inputs y outputs tipados', () => {
    writeFileSync(probe, PROBE);
    const options = {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      types: ['node'],
      typeRoots: [join(here, 'node_modules', '@types')],
    };
    const program = ts.createProgram([probe], options);
    const diags = ts
      .getPreEmitDiagnostics(program)
      .filter((d) => !d.file || d.file.fileName.replace(/\\/g, '/').endsWith('test/__probe.ts'));
    const text = diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n---\n');
    assert.equal(diags.length, 0, `El contrato perdió su tipado (¿un procedure con any?):\n${text}`);
  });
});
