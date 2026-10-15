import { MarketsInternalController } from '@/internal/markets.internal.controller';
import { MarketsModule }             from '@/markets/markets.module';
import { UsersModule }               from '@/users/users.module';
import { InternalAccessController }  from '@/internal/internal-access.controller';
// realsass-sass-back/src/internal/internal.module.ts
//
// Módulo REST para endpoints /internal/* consumidos por superadmin.
// Completamente independiente de tRPC — usa InternalApiKeyGuard propio.
// Requiere PrismaModule (global) — no importa módulos de dominio existentes
// porque la surface interna es cross-tenant (superadmin ve todas las orgs).
import { Module }                          from '@nestjs/common';
import { InternalApiKeyGuard }             from '@/internal/internal-api-key.guard';
import { InternalOrganizationsController } from '@/internal/internal-organizations.controller';
import { InternalOrganizationsService }    from '@/internal/internal-organizations.service';
import { PrismaInternalOrganizationsRepository } from '@/internal/repository/prisma-internal-organizations.repository';
import { INTERNAL_ORGANIZATIONS_REPOSITORY }     from '@/internal/repository/internal-organizations.repository.interface';

@Module({
  imports:     [MarketsModule, UsersModule],
  controllers: [InternalOrganizationsController, MarketsInternalController, InternalAccessController],
  providers:   [
    InternalApiKeyGuard,
    InternalOrganizationsService,
    { provide: INTERNAL_ORGANIZATIONS_REPOSITORY, useClass: PrismaInternalOrganizationsRepository },
  ],
})
export class InternalModule {}
