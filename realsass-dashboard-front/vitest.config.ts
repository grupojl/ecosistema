// vitest.config.ts — realsass-dashboard-front
// Cubre la lógica pura del puente con la app de escritorio (lib/desktop.ts, DT-DESK-6). environment 'node': no hay DOM.
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
