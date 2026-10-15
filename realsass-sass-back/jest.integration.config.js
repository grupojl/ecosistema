/**
 * Tests de integración contra Postgres REAL (efímera). Corren con `pnpm test:int`.
 *
 * Requieren TEST_DATABASE_URL con las migraciones aplicadas (`prisma migrate deploy`). Nunca apuntar a una base
 * compartida: los tests truncan las tablas. Los unitarios (`jest.config.js`) no matchean `*.int-spec.ts`.
 */
const base = require('./jest.config.js');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testRegex: '.*\\.int-spec\\.ts$',
  setupFiles: ['<rootDir>/../test/integration-env.js'],
  maxWorkers: 1,
  testTimeout: 30000,
  coverageThreshold: undefined,
};
