import { defineConfig } from 'vitest/config';

// Utilidades puras de @real/ui. Los componentes se verifican en realsass-design-front y en los fronts que los usan.
export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.spec.ts'] },
});
