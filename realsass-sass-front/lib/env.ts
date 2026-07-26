/**
 * Valida las variables de entorno públicas al arranque del cliente.
 * Si falta alguna, lanza un error claro en build/runtime.
 *
 * Uso: importar desde cualquier archivo que necesite acceder a env vars.
 *   import { env } from '@/lib/env'
 *   env.NEXT_PUBLIC_API_URL
 */

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `[env] Variable de entorno faltante: ${key}\n` +
      `Asegurate de definirla en .env.local antes de continuar.`,
    )
  }
  return value
}

export const env = {
  NEXT_PUBLIC_API_URL:                    requireEnv('NEXT_PUBLIC_API_URL'),
  NEXT_PUBLIC_FIREBASE_API_KEY:           requireEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:       requireEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:        requireEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:    requireEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: requireEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  NEXT_PUBLIC_FIREBASE_APP_ID:            requireEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
} as const

export type Env = typeof env
