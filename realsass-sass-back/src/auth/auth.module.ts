/**
 * auth.module.ts — realsass-sass-back
 *
 * Gestión de sesiones HttpOnly (ADR-004) + claims Firebase (ADR-003).
 *
 * Endpoints registrados:
 *   POST   /auth/session       → crea Firebase Session Cookie HttpOnly
 *   DELETE /auth/session       → revoca sesión y limpia cookie
 *   POST   /auth/sync          → sincroniza usuario con Prisma al login
 *   POST   /auth/refresh-claims → reemite custom claims (cambio de org activa)
 */
import { Module }                                       from '@nestjs/common';
import { SessionService, AuthSessionController }        from '@real/auth-server';
import { AuthService }                                  from './auth.service';
import { AuthController }                               from './auth.controller';
import { ClaimsService }                                from './claims.service';
import { UsersModule }                                  from '../users/users.module';

@Module({
  imports:     [UsersModule],
  providers:   [AuthService, ClaimsService, SessionService],
  controllers: [AuthController, AuthSessionController],
  exports:     [AuthService, ClaimsService, SessionService],
})
export class AuthModule {}
