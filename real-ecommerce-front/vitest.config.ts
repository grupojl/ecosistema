// vitest.config.ts — real-ecommerce-front
// Cubre lib/i18n, lib/seo, lib/catalog (lógica pura) y componentes de presentación sin estado, renderizados
// a string con react-dom/server. environment 'node' alcanza: no hay DOM.
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/*.spec.ts', 'components/**/*.spec.tsx', 'app/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      // Cuenta TODO el código de la app (sin `include`, v8 solo mide lo que algún test importa y un archivo sin tests no resta).
      include: ['lib/**/*.{ts,tsx}', 'components/**/*.tsx', 'app/**/*.tsx'],
      exclude: ['**/*.spec.*', '**/types.ts', 'lib/i18n/dictionaries/**'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: {
        // Piso de NO RETROCESO de todo el front (medido el 2026-11-03: ~58%). Subirlo al cubrir los componentes que faltan.
        lines: 56, statements: 56, functions: 52, branches: 52,
        // La lógica pura (idioma, SEO, catálogo) exige 85%: es lo que decide indexación y precios.
        'lib/i18n/**': { lines: 85, statements: 85, functions: 85, branches: 80 },
        'lib/seo/**': { lines: 85, statements: 85, functions: 85, branches: 80 },
        'lib/catalog/**': { lines: 85, statements: 85, functions: 85, branches: 80 },
      },
    },
  },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
