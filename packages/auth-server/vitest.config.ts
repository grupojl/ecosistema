import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Guards, middleware y sesión de los backs. Firebase se simula en cada spec; los decoradores de Nest
// necesitan reflect-metadata (setup) y el alias @/ del paquete.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts', 'src/index.ts', 'src/types/**'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: {
        // Piso de NO RETROCESO del package (medido el 2026-11-03: ~87%).
        lines: 80, statements: 80, functions: 80, branches: 88,
        // Norte de testing (Regla 2): los GUARDS tienen cobertura total de líneas y funciones.
        'src/guards/**': { lines: 100, statements: 100, functions: 100, branches: 90 },
      },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  esbuild: { target: 'es2022' },
});
