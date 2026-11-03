// vitest.config.ts — realsass-sass-front
// lib/**/*.test.ts: lógica pura (environment node). **/*.test.tsx: render con DOM; cada archivo declara
// `// @vitest-environment jsdom` (DT-TEST-05, DT-WA-07).
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/*.test.{ts,tsx}', 'components/**/*.test.tsx', 'hooks/**/*.test.tsx', 'features/**/*.test.{ts,tsx}', 'app/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      // Declara QUÉ código cuenta: sin `include`, v8 solo mide los archivos que algún test llega a importar y un archivo
      // sin tests no resta (la cobertura se ve mejor de lo que es).
      include: ["lib/**/*.{ts,tsx}","features/**/*.{ts,tsx}","hooks/**/*.{ts,tsx}","components/config/**/*.tsx"],
      exclude: ["**/*.{test,spec}.{ts,tsx}","**/*.d.ts","**/types.ts","**/types/**","lib/i18n/**"],
      reporter: ['text-summary', 'json-summary'],
      // Piso de NO RETROCESO (medido el 2026-11-03: 82% de líneas). Subirlo, nunca bajarlo.
      thresholds: { lines: 80, statements: 80, functions: 70, branches: 75 },
    },
  },
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
