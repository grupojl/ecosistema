import { defineConfig } from 'vitest/config';

// Lógica pura del cliente de auth (sin DOM): window/localStorage/fetch se simulan en cada spec.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.spec.ts'] },
});
