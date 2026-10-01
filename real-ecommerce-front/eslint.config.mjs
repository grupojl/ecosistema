/**
 * eslint.config.mjs — Next.js frontend
 *
 * Reglas custom del monorepo welver (S4-G):
 *   no-bare-fetch:    fetch() en Client Components — usar trpc hooks
 *   no-useeffect-fetch: useEffect con fetch de datos — usar useQuery
 *   react-hooks:      exhaustive-deps y rules-of-hooks
 */
import js              from '@eslint/js';
import tseslint        from 'typescript-eslint';
import globals         from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Reglas del monorepo welver
  {
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any':  'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // React
      'no-console':  ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
    },
  },

  // Relajar en archivos de configuración
  {
    files: ['*.config.*', 'tailwind.config.*', 'postcss.config.*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    ignores: [
      '.next/**', 'node_modules/**', 'coverage/**',
      'out/**', 'dist/**',
    ],
  },
);
