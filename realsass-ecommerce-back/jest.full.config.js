/**
 * Corrida COMPLETA de cobertura: incluye los tests de integración contra Postgres real, que cubren los repositorios Prisma.
 *   1. node scripts/test-db-setup.mjs
 *   2. TEST_DATABASE_URL=... TEST_APP_DATABASE_URL=... pnpm test:cov:full
 * Piso de CI de esta corrida (DT-TEST-13): 90% de líneas, medido el 2026-11-03 en ~92%.
 */
const base = require('./jest.config');

module.exports = {
  ...base,
  coverageThreshold: {
    global: { lines: 90, statements: 90, functions: 83, branches: 80 },
  },
};
