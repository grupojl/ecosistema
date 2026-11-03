/**
 * Superficie pública de @real/trpc (ADR-019): lo que los fronts pueden importar, y que cada procedure que el contrato de
 * autorización (access-matrix) clasifica exista de verdad en el contrato publicado (dist). Si se agrega o renombra un
 * procedure, access-matrix y el dist tienen que cambiar juntos.
 * Corre con `node --test`; requiere `pnpm contracts` previo.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(here, '..', '..');
const dist = join(here, 'dist');
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('package.json exports', () => {
  it('cada entrada de exports apunta a un archivo que existe en dist', () => {
    for (const [name, entry] of Object.entries(pkg.exports)) {
      for (const target of [entry.types, entry.default]) {
        assert.ok(existsSync(join(here, target)), `exports["${name}"] apunta a ${target}, que no existe`);
      }
    }
  });

  it('typesVersions resuelve ./markets al .d.ts de la hoja', () => {
    const [target] = pkg.typesVersions['*'].markets;
    assert.ok(existsSync(join(here, target)));
  });
});

describe('hoja de markets', () => {
  const markets = readFileSync(join(dist, 'markets.d.ts'), 'utf8');
  it('exporta MarketDTO y FulfillmentConfig', () => {
    assert.match(markets, /export type MarketDTO/);
    assert.match(markets, /export type FulfillmentConfig/);
  });
  it('no importa nada de los backs (es una hoja sin ciclo)', () => {
    assert.doesNotMatch(markets, /\bimport\b/);
  });
});

describe('index del contrato', () => {
  const index = readFileSync(join(dist, 'index.js'), 'utf8');
  it('reexporta los helpers del servidor que usan los fronts', () => {
    for (const name of ['createContext', 'createTRPCRouter', 'publicProcedure', 'protectedProcedure']) {
      assert.match(index, new RegExp(String.raw`\b${name}\b`), `index.js no exporta ${name}`);
    }
  });
});

/** Claves 'router.procedure' del CONTRACT de access-matrix de un back. */
function matrixProcedures(back) {
  const src = readFileSync(join(root, back, 'src', 'trpc', 'access-matrix.spec.ts'), 'utf8');
  const block = src.slice(src.indexOf('const CONTRACT'));
  return [...block.matchAll(/^\s*'([\w]+\.[\w]+)':\s*\[/gm)].map((m) => m[1]);
}

describe('access-matrix ↔ dist', () => {
  for (const [back, contract] of [['realsass-sass-back', 'sass-back'], ['realsass-ecommerce-back', 'ecommerce-back']]) {
    it(`${contract}: todo procedure clasificado existe en el contrato publicado`, () => {
      const procedures = matrixProcedures(back);
      assert.ok(procedures.length > 10, `access-matrix de ${back} casi vacío (${procedures.length})`);
      const routerFiles = walk(join(dist, 'contracts', contract)).filter((p) => p.includes(`${sep}trpc${sep}`) && p.endsWith('.d.ts'));
      const text = routerFiles.map((p) => readFileSync(p, 'utf8')).join('\n');
      const missing = procedures.filter((key) => !new RegExp(String.raw`\b${key.split('.')[1]}\b`).test(text));
      assert.deepEqual(missing, [], `Procedures de access-matrix ausentes en dist/contracts/${contract}: ${missing.join(', ')}`);
    });
  }
});
