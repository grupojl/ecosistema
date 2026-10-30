// vitest.config.ts — realsass-sass-front
// Lógica pura de lib/ (sin DOM). Los componentes se prueban cuando haya runner de UI (DT-WA-07).
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
