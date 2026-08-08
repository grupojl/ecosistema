// middleware.ts
//
// Corre en el Edge Runtime ANTES de que cualquier página se renderice.
// Lee la cookie __session que contiene el Firebase ID token.
//
// Si no existe → redirect a /login.
// Si existe   → deja pasar. El SDK de Firebase en el cliente ya tiene
//               la sesión restaurada porque la seteamos antes de navegar.
//
// IMPORTANTE: Este middleware NO verifica la firma del JWT (eso requiere
// Firebase Admin que no corre en Edge). Solo verifica presencia + expiración
// básica del token (campo exp del payload). La verificación criptográfica
// real la hacen los backends (realsass-sass-back y realsass-ecommerce-back)
// con Firebase Admin en cada request autenticado.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = '__session';

function isTokenExpired(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return true;
    // Edge Runtime tiene atob
    const payload = JSON.parse(atob(payloadB64)) as { exp?: number };
    if (!payload.exp) return true;
    // exp es en segundos, Date.now() en ms
    return Date.now() / 1000 > payload.exp;
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas que no necesitan auth — dejar pasar siempre
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||   // nuestros route handlers de sesión
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Para todo lo demás bajo /dashboard/*
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionCookie || isTokenExpired(sessionCookie)) {
    const loginUrl = new URL('/login', request.url);
    // Guardamos el destino para redirigir después del login
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Aplica solo a rutas del dashboard — no a assets estáticos ni API routes
  matcher: ['/dashboard/:path*'],
};
