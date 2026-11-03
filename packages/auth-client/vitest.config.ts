import { defineConfig } from 'vitest/config';

// Lógica del cliente de auth: window/localStorage/fetch/Firebase se simulan en cada spec. Los .spec.tsx (AuthProvider,
// hooks) declaran `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      // Cuenta TODO el código del package (sin include, un archivo sin tests no resta).
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.spec.*', 'src/**/*.d.ts', 'src/index.ts', 'src/types/**'],
      reporter: ['text-summary', 'json-summary'],
      // Piso de NO RETROCESO (medido el 2026-11-03: 81% de líneas). Subirlo, nunca bajarlo.
      thresholds: { lines: 78, statements: 78, functions: 78, branches: 64 },
    },
  },
  esbuild: { jsx: 'automatic' },
});
