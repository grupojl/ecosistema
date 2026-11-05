// vitest.config.ts — realsass-dashboard-front
// lib/**/*.test.ts: lógica pura (puente de escritorio, DT-DESK-6), environment 'node'.
// **/*.test.tsx: render con DOM; cada archivo declara `// @vitest-environment jsdom` (DT-TEST-05).
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx', 'app/**/*.test.tsx', 'components/**/*.test.tsx', 'features/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Declara QUÉ código cuenta: sin `include`, v8 solo mide los archivos que algún test llega a importar y un archivo
      // sin tests no resta (la cobertura se ve mejor de lo que es).
      include: ["lib/**/*.{ts,tsx}"],
      exclude: ["**/*.{test,spec}.{ts,tsx}","**/*.d.ts","**/types.ts","**/types/**","lib/i18n/**"],
      reporter: ['text-summary', 'json-summary'],
      // Piso de NO RETROCESO (medido el 2026-11-03: 92% de líneas). Subirlo, nunca bajarlo.
      thresholds: { lines: 90, statements: 91, functions: 85, branches: 86 },
    },
  },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
