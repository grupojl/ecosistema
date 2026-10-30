import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Guards, middleware y sesión de los backs. Firebase se simula en cada spec; los decoradores de Nest
// necesitan reflect-metadata (setup) y el alias @/ del paquete.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.spec.ts'], setupFiles: ['./vitest.setup.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  esbuild: { target: 'es2022' },
});
