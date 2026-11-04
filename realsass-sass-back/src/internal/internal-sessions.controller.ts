import { SkipThrottle, Throttle } from '@nestjs/throttler';
// realsass-sass-back/src/internal/internal-sessions.controller.ts
//
// ADR-020 / DT-SES-05: el ecommerce-back también valida las sesiones cerradas desde "Dispositivos".
// Canal servicio-a-servicio (x-internal-api-key), igual que /internal/access.
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Public } from '@real/auth-server';
import { InternalApiKeyGuard } from '@/internal/internal-api-key.guard';
import { SessionsService } from '@/sessions/sessions.service';

@Public() // el APP_GUARD de Firebase no aplica: acá manda InternalApiKeyGuard
@UseGuards(InternalApiKeyGuard)
// DT-STORE-1: servicio-a-servicio (INTERNAL_API_KEY). No cae en el limitador `auth` (pensado para login) y tiene un tope
// propio holgado: todo el tráfico del storefront sale de pocas IPs y el 30/min global lo cortaría.
@SkipThrottle({ auth: true })
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller('internal/sessions')
export class InternalSessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** Un sid desconocido NO está revocado (cookies anteriores a ADR-020). El cache de 30 s lo pone SessionsService. */
  @Get(':sid/revoked')
  async revoked(
    @Param('sid') sid: string,
    @Query('uid') uid: string,
  ): Promise<{ revoked: boolean }> {
    return { revoked: await this.sessions.isRevoked(sid, uid ?? '') };
  }
}
