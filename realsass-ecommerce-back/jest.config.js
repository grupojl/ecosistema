/** @type {import('jest').Config} */
// Única configuración de Jest del back (antes convivía con una clave `jest` en package.json y Jest se negaba a correr).
const { pathsToModuleNameMapper } = require('ts-jest');
const ts = require('typescript');

// Los alias de tsconfig.json (`@/*` y los que apuntan a ../packages/auth-server/src) valen también en los tests.
// Los específicos van ANTES que `@/*`: el primero que coincide gana.
const { config } = ts.readConfigFile('./tsconfig.json', ts.sys.readFile);
const fromTsconfig = pathsToModuleNameMapper(config.compilerOptions.paths ?? {}, { prefix: '<rootDir>/../' });
const specific = Object.fromEntries(Object.entries(fromTsconfig).filter(([k]) => k !== '^@/(.*)$'));

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  // tsconfig.spec.json fija rootDir: sin eso TS 6 falla con TS5011. diagnostics:false → los tipos los chequea `tsc --noEmit`.
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json', diagnostics: false }] },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts', '!**/main.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    global: { lines: 85, functions: 85, branches: 75, statements: 85 },
  },
  moduleNameMapper: {
    ...specific,
    '^@/(.*)$': '<rootDir>/$1',
  },
  testTimeout: 10000,
};
