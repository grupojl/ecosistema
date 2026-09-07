// realsass-sass-back/src/internal/internal.module.ts
// ADR-010 — módulo de endpoints internos para superadmin.
// PrismaModule es @Global() en sass-back — no necesita importarse aquí.
import { Module }                              from '@nestjs/common';
import { InternalOrganizationsController }     from './internal-organizations.controller';
import { InternalApiKeyGuard }                 from '../common/guards/internal-api-key.guard';

@Module({
  controllers: [InternalOrganizationsController],
  providers:   [InternalApiKeyGuard],
})
export class InternalModule {}
