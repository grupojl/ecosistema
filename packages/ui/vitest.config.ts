import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Utilidades puras (environment node) y comportamiento/accesibilidad de los componentes base.
// Los archivos .spec.tsx declaran `// @vitest-environment jsdom` (DT-TEST-05).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts', 'test/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      // Cuenta TODO el código del package (sin include, un componente sin tests no resta).
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.spec.*', 'src/index.ts', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary'],
      // Piso de NO RETROCESO. La mayoría de los componentes son envoltorios finos de Radix; el objetivo es cubrir los que tienen
      // lógica propia (ya hecho: login, combobox, paginación, paleta, dispositivos, navegación) y subir este piso con cada uno.
      thresholds: { lines: 30, statements: 30, functions: 27, branches: 33 },
    },
  },
  esbuild: { jsx: 'automatic' },
  resolve: {
    // Los componentes se importan a sí mismos como `@real/ui/utils`; dentro del package no hay link en node_modules.
    alias: { '@real/ui/utils': path.resolve(__dirname, 'src/utils/cn.ts') },
  },
});
