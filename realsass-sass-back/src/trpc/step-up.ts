import { TRPCError } from '@trpc/server';
import { getAuth } from 'firebase-admin/auth';
import type { Request } from 'express';
import { SESSION_COOKIE_NAME } from '@real/auth-server';
import { AppCodeError } from '@/trpc/app-code-error';

const STEP_UP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Exige re-autenticación reciente (auth_time dentro de los últimos 5 min) para acciones sensibles:
 * secretos, webhooks. Funciona con Bearer o con la cookie de sesión (ADR-004): la cookie conserva el
 * auth_time del inicio de sesión real, así que una sesión vieja pide re-login aunque la cookie se haya renovado.
 *
 * El front reconoce `error.data.appCode === 'REAUTH_REQUIRED'`, reautentica y reintenta.
 */
export async function enforceStepUp(req: Request): Promise<void> {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const cookie = (
    req.cookies as Record<string, string | undefined> | undefined
  )?.[SESSION_COOKIE_NAME];

  let authTimeSec: number | undefined;
  try {
    if (bearer) authTimeSec = (await getAuth().verifyIdToken(bearer)).auth_time;
    else if (cookie)
      authTimeSec = (await getAuth().verifySessionCookie(cookie, true))
        .auth_time;
  } catch {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Sesión inválida o vencida',
    });
  }

  if (authTimeSec === undefined)
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sesión requerida' });

  if (Date.now() - authTimeSec * 1000 > STEP_UP_WINDOW_MS) {
    const message = 'Por seguridad, confirmá tu identidad para continuar';
    throw new TRPCError({
      code: 'FORBIDDEN',
      message,
      cause: new AppCodeError('REAUTH_REQUIRED', message),
    });
  }
}
