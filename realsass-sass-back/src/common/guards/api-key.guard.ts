import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { matchesAnyKey } from '@real/auth-server';

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
    const req    = ctx.switchToHttp().getRequest<Request>();
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new UnauthorizedException('Header x-api-key requerido');
    }

    // Tiempo constante y claves rotables ("nueva,vieja"). Sin claves configuradas => rechaza (falla cerrado).
    // El motivo no se le explica al cliente: un 401 uniforme no revela si el servidor está mal configurado.
    if (!matchesAnyKey(apiKey, process.env['INTERNAL_API_KEY'])) {
      throw new UnauthorizedException('API Key invalida');
    }

    return true;
  }
}
