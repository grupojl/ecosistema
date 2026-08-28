import { Module }                    from '@nestjs/common';
import { ConfigTemplatesController } from './config-templates.controller';
import { ConfigTemplatesService }    from './config-templates.service';
import { PrismaTemplatesRepository } from './repository/prisma-templates.repository';
import { TEMPLATES_REPOSITORY }      from './repository/templates.repository.interface';
import { PrismaModule }              from '../prisma/prisma.module';
import { ConfigCacheModule }         from '../config-cache/config-cache.module';
import { ConfigAuditModule }         from '../config-audit/config-audit.module';

@Module({
  imports:     [PrismaModule, ConfigCacheModule, ConfigAuditModule],
  controllers: [ConfigTemplatesController],
  providers:   [
    ConfigTemplatesService,
    { provide: TEMPLATES_REPOSITORY, useClass: PrismaTemplatesRepository },
  ],
  exports:     [ConfigTemplatesService],
})
export class ConfigTemplatesModule {}
