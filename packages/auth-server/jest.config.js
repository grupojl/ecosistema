/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testRegex: '.*\.spec\.ts$',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  // El paquete se compila con el tsconfig de cada back; acá solo se transpila para correr los tests.
  transform: {
    '^.+\.ts$': ['ts-jest', {
      diagnostics: false,
      tsconfig: { module: 'commonjs', target: 'ES2023', esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true, isolatedModules: true },
    }],
  },
  // Los alias '@/…' internos del paquete apuntan a src/ (igual que en tsconfig.json).
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1', '^jose$': '<rootDir>/../test/stubs/jose.js' },
  coverageDirectory: '../coverage',
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!index.ts', '!**/index.ts'],
  // Los umbrales solo suben (ADR-024): se fijan al valor medido y el CI falla si baja.
  coverageThreshold: { global: { lines: 64, functions: 55, branches: 63, statements: 64 } },
};
