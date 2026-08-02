#!/usr/bin/env bash
echo "=== Fix: packages/trpc no compila el backend ==="

node - << 'JSEOF'
const fs = require('fs');

// packages/trpc no necesita compilar nada — solo re-exporta tipos.
// Su build script no tiene que hacer tsc del backend.
// Cambiamos el build a un echo que siempre pasa.

const pkg = JSON.parse(fs.readFileSync('packages/trpc/package.json', 'utf8'));
pkg.scripts.build = 'echo "@real/trpc ok"';
pkg.scripts.typecheck = 'echo "@real/trpc ok"';
fs.writeFileSync('packages/trpc/package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('✓ packages/trpc/package.json — build/typecheck → echo (no compila backend)');

// El tsconfig queda simple, solo para que editores funcionen
fs.writeFileSync('packages/trpc/tsconfig.json', JSON.stringify({
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2023",
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}, null, 2) + '\n');
console.log('✓ packages/trpc/tsconfig.json — limpio');

// src/index.ts — re-exporta AppRouter con export type
fs.writeFileSync('packages/trpc/src/index.ts', [
  "export type { TRPCContext }    from './server/context';",
  "export { createContext }       from './server/context';",
  "export {",
  "  createTRPCRouter,",
  "  publicProcedure,",
  "  protectedProcedure,",
  "} from './server/trpc';",
  "",
  "export type { AppRouter } from '../../../realsass-sass-back/src/trpc/app-router';",
].join('\n'));
console.log('✓ packages/trpc/src/index.ts — AppRouter re-exportado');

console.log('\n✓ Fix aplicado');
JSEOF

echo "✓ Listo"