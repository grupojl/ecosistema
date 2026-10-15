/**
 * Configuración ÚNICA de jest (antes había otra en la clave "jest" de package.json y jest ni arrancaba:
 * "Multiple configurations found").
 *
 * Los alias salen del tsconfig (paths), así que los tests resuelven '@/…' y los '@/…' de @real/auth-server
 * exactamente igual que el compilador.
 */
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

// TypeScript prioriza los alias exactos sobre el comodín '@/*'; jest toma el primero que coincide:
// los exactos van primero.
const tsPaths = Object.fromEntries(
  Object.entries(compilerOptions.paths).sort(([a], [b]) => Number(a.includes('*')) - Number(b.includes('*'))),
);

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { diagnostics: false }] },
  moduleNameMapper: {
    // jose@6 (traída por firebase-admin) es solo ESM y jest corre en CommonJS. Ver test/stubs/jose.js.
    '^jose$': '<rootDir>/../test/stubs/jose.js',
    ...pathsToModuleNameMapper(tsPaths, { prefix: '<rootDir>/../' }),
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!**/main.ts', '!**/*.spec.ts', '!**/__tests__/**', '!generated/**', '!**/*.d.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // Los umbrales solo suben (ver ADR-024): se fijan al valor medido y el CI falla si baja.
  coverageThreshold: { global: { lines: 73, functions: 63, branches: 67, statements: 73 } },
  testTimeout: 10000,
};
