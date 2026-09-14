/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts', '!**/main.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      lines:     85,
      functions: 85,
      branches:  75,
      statements: 85,
    },
  },
  // Prohibir imports de NestJS en tests de domain/
  moduleNameMapper: {},
  // Tests lentos → timeout explícito
  testTimeout: 10000,
};
