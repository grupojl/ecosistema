// vitest.config.ts — real-ecommerce-front
// Cubre lib/i18n, lib/seo, lib/catalog (lógica pura) y componentes de presentación sin estado, renderizados
// a string con react-dom/server. environment 'node' alcanza: no hay DOM.
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.spec.ts', 'components/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      include: ['lib/i18n/**', 'lib/seo/**', 'lib/catalog/**'],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 80 },
    },
  },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
