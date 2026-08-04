#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix CSP hardcoded en realsass-sass-front
#
# Problema: next.config.mjs tiene localhost:3000 y localhost:3001 hardcodeados
#           en connect-src, y use-dashboard-sso.ts tiene localhost:3004 como
#           fallback. En producción (Railway) el CSP bloquea el SSO porque
#           la URL del sass-back no está en la lista permitida.
#
# Solución: el connect-src lee NEXT_PUBLIC_API_URL y NEXT_PUBLIC_SASS_BACK_URL
#           para armar las entradas dinámicas. En producción esas vars apuntan
#           a las URLs de Railway; en dev apuntan a localhost.
#
# Variables de entorno requeridas en Railway (realsass-sass-front):
#   NEXT_PUBLIC_API_URL          → https://tu-sass-back.up.railway.app/api/v1
#   NEXT_PUBLIC_SASS_BACK_URL    → https://tu-sass-back.up.railway.app
#   NEXT_PUBLIC_DASHBOARD_FRONT_URL → https://tu-dashboard.up.railway.app
#   NEXT_PUBLIC_FIREBASE_PROJECT_ID → tu-project-id
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
log() { echo -e "[→] $1"; }

TARGET="realsass-sass-front/next.config.mjs"

log "Reescribiendo $TARGET ..."

cat > "$TARGET" << 'NEXTCONFIG'
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  async headers() {
    const firebaseProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ''

    // URLs externas leídas de variables de entorno.
    // En Railway estas vars apuntan a los dominios reales.
    // En dev apuntan a localhost (configuradas en .env.local).
    const sassBackUrl    = (process.env.NEXT_PUBLIC_SASS_BACK_URL ?? '').replace(/\/+$/, '')
    const dashFrontUrl   = (process.env.NEXT_PUBLIC_DASHBOARD_FRONT_URL ?? '').replace(/\/+$/, '')
    const apiUrl         = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '')

    // Extrae solo origin (protocolo + host) de una URL completa.
    // Ej: "https://foo.up.railway.app/api/v1" → "https://foo.up.railway.app"
    function origin(url) {
      if (!url) return ''
      try { return new URL(url).origin } catch { return url }
    }

    // Construye connect-src con todos los orígenes necesarios,
    // deduplicados y sin entradas vacías.
    const connectOrigins = [
      "'self'",
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://*.googleapis.com',
      'https://*.firebaseio.com',
      'https://*.firebase.google.com',
      'https://*.firebasestorage.googleapis.com',
      'https://*.railway.app',
      'https://*.up.railway.app',
      origin(sassBackUrl),
      origin(apiUrl),
      origin(dashFrontUrl),
    ].filter(Boolean)

    // Dedup sin Set para compatibilidad con todos los entornos de build
    const seen = {}
    const connectSrc = connectOrigins
      .filter(v => { if (seen[v]) return false; seen[v] = true; return true })
      .join(' ')

    const csp = [
      "default-src 'self'",
      [
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        'https://apis.google.com',
        'https://appleid.apple.com',
        'https://connect.facebook.net',
        'https://www.facebook.com',
      ].join(' '),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      [
        "frame-src 'self'",
        'https://accounts.google.com',
        'https://appleid.apple.com',
        'https://www.facebook.com',
        'https://facebook.com',
        firebaseProject ? `https://${firebaseProject}.firebaseapp.com` : '',
        'https://*.iam.gserviceaccount.com',
      ].filter(Boolean).join(' '),
      `connect-src ${connectSrc}`,
      [
        "img-src 'self' data: blob:",
        'https://*.googleusercontent.com',
        'https://*.fbcdn.net',
        'https://*.facebook.com',
        'https://*.firebasestorage.googleapis.com',
      ].join(' '),
      "form-action 'self'",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
    ].map(d => d.trim()).join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: '*.fbcdn.net' },
    ],
  },

  poweredByHeader: false,
}

export default nextConfig
NEXTCONFIG

ok "$TARGET actualizado"

# -----------------------------------------------------------------------------
# use-dashboard-sso.ts
# Elimina el fallback localhost:3004 — si la var no está configurada, falla
# ruidosamente en runtime con un mensaje claro en lugar de conectarse a nada.
# -----------------------------------------------------------------------------

SSO_HOOK="realsass-sass-front/hooks/use-dashboard-sso.ts"
log "Reescribiendo $SSO_HOOK ..."

cat > "$SSO_HOOK" << 'SSOHOOK'
// hooks/use-dashboard-sso.ts
'use client'

import { useState, useCallback } from 'react'

// Sin fallbacks hardcodeados — las URLs vienen siempre de variables de entorno.
// En Railway: configuradas en Settings → Variables del servicio realsass-sass-front.
// En dev: configuradas en realsass-sass-front/.env.local
//   NEXT_PUBLIC_SASS_BACK_URL=http://localhost:3004
//   NEXT_PUBLIC_DASHBOARD_FRONT_URL=http://localhost:3002
const SASS_BACK_URL: string =
  (process.env.NEXT_PUBLIC_SASS_BACK_URL ?? '').replace(/\/+$/, '')

const DASHBOARD_FRONT_URL: string =
  (process.env.NEXT_PUBLIC_DASHBOARD_FRONT_URL ?? '').replace(/\/+$/, '')

export type SsoState = 'idle' | 'loading' | 'success' | 'error'

export function useDashboardSSO(
  getIdToken: () => Promise<string | null | undefined>,
) {
  const [state,    setState]    = useState<SsoState>('idle')
  const [ssoError, setSsoError] = useState<string | null>(null)

  const openDashboard = useCallback(async () => {
    if (!SASS_BACK_URL) {
      setSsoError('NEXT_PUBLIC_SASS_BACK_URL no está configurada.')
      setState('error')
      setTimeout(() => { setState('idle'); setSsoError(null) }, 5000)
      return
    }

    if (!DASHBOARD_FRONT_URL) {
      setSsoError('NEXT_PUBLIC_DASHBOARD_FRONT_URL no está configurada.')
      setState('error')
      setTimeout(() => { setState('idle'); setSsoError(null) }, 5000)
      return
    }

    setState('loading')
    setSsoError(null)

    try {
      const firebaseToken = await getIdToken()
      if (!firebaseToken) throw new Error('No se pudo obtener el token de sesión')

      const res = await fetch(`${SASS_BACK_URL}/api/v1/auth/firebase-sso`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ firebaseIdToken: firebaseToken }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string }
        throw new Error(body.message ?? `Error del servidor: ${res.status}`)
      }

      const data = await res.json() as { customToken: string }

      setState('success')

      setTimeout(() => {
        window.location.href =
          `${DASHBOARD_FRONT_URL}/auth/sso?token=${encodeURIComponent(data.customToken)}`
      }, 300)

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al conectar con el dashboard'
      setSsoError(msg)
      setState('error')
      setTimeout(() => { setState('idle'); setSsoError(null) }, 5000)
    }
  }, [getIdToken])

  return { state, ssoError, openDashboard }
}
SSOHOOK

ok "$SSO_HOOK actualizado"

echo ""
echo "============================================================"
echo "  Variables requeridas en Railway → realsass-sass-front"
echo "============================================================"
echo "  NEXT_PUBLIC_SASS_BACK_URL         → URL pública del sass-back"
echo "  NEXT_PUBLIC_DASHBOARD_FRONT_URL   → URL pública del dashboard-front"
echo "  NEXT_PUBLIC_API_URL               → URL pública del sass-back + /api/v1"
echo "  NEXT_PUBLIC_FIREBASE_PROJECT_ID   → tu firebase project id"
echo "============================================================"
echo ""
ok "Listo. Commiteá y Railway redeploya con el CSP dinámico."