import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common';
import * as admin from 'firebase-admin';

/**
 * StepUpGuard — exige re-autenticacion reciente (maximo 5 minutos).
 * Se usa en operaciones criticas que requieren que el usuario haya
 * ingresado su password recientemente:
 *   POST /config/secrets/:id/rotate
 *   DELETE /config/secrets/:id
 *
 * NO es un APP_GUARD global — se aplica inline con @UseGuards(StepUpGuard).
 * Funciona verificando auth_time del Firebase idToken.
 */
@Injectable()
export class StepUpGuard implements CanActivate {
  private readonly WINDOW_MS = 5 * 60 * 1_000; // 5 minutos

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req   = ctx.switchToHttp().getRequest();
    const token = (req.headers['authorization'] as string | undefined)?.split(' ')[1];

    if (!token) throw new ForbiddenException('Token requerido para esta accion');

    const decoded  = await admin.app().auth().verifyIdToken(token);
    const authTime = decoded.auth_time * 1_000;

    if (Date.now() - authTime > this.WINDOW_MS) {
      throw new ForbiddenException(
        'Re-autenticacion requerida. Cerrá sesion y volvé a ingresar.',
      );
    }

    return true;
  }
}
