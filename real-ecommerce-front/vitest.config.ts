// vitest.config.ts — real-ecommerce-front
// Cubre lib/i18n, lib/seo, lib/catalog: lógica pura, sin DOM. environment
// 'node' alcanza (no se testean componentes React en esta ronda).
// app/**: humo del storefront. Las páginas (Server Components async) se ejecutan y su JSX se
// renderiza con react-dom/server, sin DOM.
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['lib/**/*.spec.ts', 'app/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['lib/i18n/**', 'lib/seo/**', 'lib/catalog/**'],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 80 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
