// realsass-sass-back/src/internal/internal-sessions.controller.ts
//
// ADR-020 / DT-SES-05: el ecommerce-back también valida las sesiones cerradas desde "Dispositivos".
// Canal servicio-a-servicio (x-internal-api-key), igual que /internal/access.
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Public }                                   from '@real/auth-server';
import { InternalApiKeyGuard }                      from '@/internal/internal-api-key.guard';
import { SessionsService }                          from '@/sessions/sessions.service';

@Public() // el APP_GUARD de Firebase no aplica: acá manda InternalApiKeyGuard
@UseGuards(InternalApiKeyGuard)
@Controller('internal/sessions')
export class InternalSessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** Un sid desconocido NO está revocado (cookies anteriores a ADR-020). El cache de 30 s lo pone SessionsService. */
  @Get(':sid/revoked')
  async revoked(@Param('sid') sid: string, @Query('uid') uid: string): Promise<{ revoked: boolean }> {
    return { revoked: await this.sessions.isRevoked(sid, uid ?? '') };
  }
}
