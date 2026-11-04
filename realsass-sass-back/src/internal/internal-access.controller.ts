import { SkipThrottle, Throttle } from '@nestjs/throttler';
// realsass-sass-back/src/internal/internal-access.controller.ts
//
// Canal servicio-a-servicio para resolver "¿este usuario puede operar esta organización?".
// Lo consume realsass-ecommerce-back (y los microservicios de ecosistema-ms) con credencial de
// servicio (x-internal-api-key), SIN sesión de usuario.
//
// Reemplaza a GET /auth/organization-access, que exigía reenviar el Bearer del usuario: con la
// sesión por cookie HttpOnly (ADR-004) el back de ecommerce ya no tiene ese token para reenviar.
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Public } from '@real/auth-server';
import type { OrganizationAccessResult } from '@real/auth-server';
import { InternalApiKeyGuard } from '@/internal/internal-api-key.guard';
import { UsersService } from '@/users/users.service';

@Public() // el APP_GUARD de Firebase no aplica: acá manda InternalApiKeyGuard
@UseGuards(InternalApiKeyGuard)
// DT-STORE-1: servicio-a-servicio (INTERNAL_API_KEY). No cae en el limitador `auth` (pensado para login) y tiene un tope
// propio holgado: todo el tráfico del storefront sale de pocas IPs y el 30/min global lo cortaría.
@SkipThrottle({ auth: true })
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller('internal/access')
export class InternalAccessController {
  constructor(private readonly users: UsersService) {}

  @Get(':organizationId/:firebaseUid')
  access(
    @Param('organizationId') organizationId: string,
    @Param('firebaseUid') firebaseUid: string,
  ): Promise<OrganizationAccessResult> {
    return this.users.getOrganizationAccess(firebaseUid, organizationId);
  }
}
