// realsass-sass-back/src/internal/internal.module.ts
//
// Módulo REST para endpoints /internal/* consumidos por superadmin.
// Completamente independiente de tRPC — usa InternalApiKeyGuard propio.
// Requiere PrismaModule (global) — no importa módulos de dominio existentes
// porque la surface interna es cross-tenant (superadmin ve todas las orgs).
import { Module }                          from '@nestjs/common';
import { InternalApiKeyGuard }             from './internal-api-key.guard';
import { InternalOrganizationsController } from './internal-organizations.controller';
import { InternalOrganizationsService }    from './internal-organizations.service';

@Module({
  controllers: [InternalOrganizationsController],
  providers:   [InternalApiKeyGuard, InternalOrganizationsService],
})
export class InternalModule {}
