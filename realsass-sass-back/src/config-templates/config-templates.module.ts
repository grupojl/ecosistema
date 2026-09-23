import { Module }                    from '@nestjs/common';
import { ConfigTemplatesService }    from '@/config-templates/config-templates.service';
import { PrismaTemplatesRepository } from '@/config-templates/repository/prisma-templates.repository';
import { TEMPLATES_REPOSITORY }      from '@/config-templates/repository/templates.repository.interface';
import { PrismaModule }              from '@/prisma/prisma.module';
import { ConfigCacheModule }         from '@/config-cache/config-cache.module';
import { ConfigAuditModule }         from '@/config-audit/config-audit.module';

@Module({
  imports:     [PrismaModule, ConfigCacheModule, ConfigAuditModule],
  
  providers:   [
    ConfigTemplatesService,
    { provide: TEMPLATES_REPOSITORY, useClass: PrismaTemplatesRepository },
  ],
  exports:     [ConfigTemplatesService],
})
export class ConfigTemplatesModule {}
