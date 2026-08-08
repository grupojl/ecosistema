// app/api/auth/session/route.ts
//
// POST /api/auth/session { idToken: string }
//   Recibe el Firebase ID token desde el cliente y lo persiste en una
//   cookie HttpOnly. Llamado desde app/auth/sso/page.tsx después de
//   signInWithCustomToken, y desde auth-context después de cada login.
//
// DELETE /api/auth/session
//   Borra la cookie (logout).
//
// La cookie es HttpOnly → JS del cliente no puede leerla → más seguro.
// El middleware.ts la lee en el Edge para proteger /dashboard/*.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE  = '__session';
const ONE_HOUR_SECS   = 60 * 60;           // Firebase ID tokens duran 1 hora
const COOKIE_MAX_AGE  = ONE_HOUR_SECS - 60; // 59 min — margen para el refresh

function cookieOptions(maxAge: number) {
  return {
    httpOnly:  true,
    secure:    process.env.NODE_ENV === 'production',
    sameSite:  'lax' as const,   // 'lax' permite el redirect del SSO
    path:      '/',
    maxAge,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { idToken?: string };
    const { idToken } = body;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'idToken requerido' },
        { status: 400 },
      );
    }

    // Verificación básica: que sea un JWT de 3 partes
    if (idToken.split('.').length !== 3) {
      return NextResponse.json(
        { error: 'idToken inválido' },
        { status: 400 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, idToken, cookieOptions(COOKIE_MAX_AGE));
    return response;

  } catch {
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  return response;
}
