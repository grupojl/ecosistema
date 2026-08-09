import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';

/**
 * ApiKeyGuard — valida el header x-api-key contra INTERNAL_API_KEY.
 *
 * Usado en rutas internas de config que consumen servicios del ecosistema:
 *   GET /config/secrets/resolve/:key  (ecommerce-back, chat-back, etc.)
 *   GET /config/flags/:orgId          (servicios externos)
 *   GET /config/templates/:key        (servicios externos)
 *
 * Configuracion requerida en .env:
 *   INTERNAL_API_KEY=tu-clave-secreta-interna
 *
 * Esta implementacion es correcta para la etapa actual donde los consumidores
 * son servicios internos del ecosistema. Cuando se necesiten API Keys por
 * organizacion (modelo ApiKey en schema), se puede reemplazar esta implementacion
 * sin cambiar los controllers que la usan.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req    = ctx.switchToHttp().getRequest();
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new UnauthorizedException('Header x-api-key requerido');
    }

    const validKey = process.env['INTERNAL_API_KEY'];

    if (!validKey) {
      throw new UnauthorizedException('INTERNAL_API_KEY no configurada en el servidor');
    }

    if (apiKey !== validKey) {
      throw new UnauthorizedException('API Key invalida');
    }

    return true;
  }
}
