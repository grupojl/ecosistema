// src/health/health.controller.ts
//
// @Public() es OBLIGATORIO: el APP_GUARD global (FirebaseAuthGuard) aplica
// a todas las rutas. Sin este decorador Railway recibe 401 en cada intento
// de healthcheck y el deploy nunca pasa.

import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../common/guards/firebase-auth.guard';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
