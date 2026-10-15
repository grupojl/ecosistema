/**
 * eslint.config.mjs — realsass-sass-front
 *
 * Reglas del monorepo (Ecosistema Real):
 *   - sin `any`, sin variables sin uso (prefijo _ para ignorar a propósito)
 *   - sin console suelto (solo warn/error)
 *   - `fetch` prohibido fuera de FETCH_ALLOWLIST: todo lo interno va por tRPC (ADR-005).
 *     Para sumar una excepción hay que justificarla en el PR y listarla acá.
 */
import js       from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals  from 'globals'

// Excepciones documentadas al principio "todo interno por tRPC":
//   - clientes HTTP de servicios externos / wrappers del link de tRPC
//   - bootstrap de sesión (POST/DELETE /auth/session — ADR-004)
const FETCH_ALLOWLIST = [
  'context/auth-context.tsx',
  'lib/trpc/**',
]

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },    },
  },

  {
    rules: {
  '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-console':  ['warn', { allow: ['warn', 'error'] }],
  'no-debugger': 'error',
      'no-restricted-globals': ['error', {
        name: 'fetch',
        message: 'Usá tRPC (hooks o server caller). fetch directo solo en FETCH_ALLOWLIST — ver ADR-005.',
      }],
    },
  },

  { files: FETCH_ALLOWLIST, rules: { 'no-restricted-globals': 'off' } },

  {
    ignores: [
  '.next/**', 'node_modules/**', 'coverage/**', 'out/**', 'dist/**',
  'next-env.d.ts', '**/*.config.*', 'repomix.config.json',
    ],
  },
)
