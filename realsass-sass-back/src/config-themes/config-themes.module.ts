import { Module }                  from '@nestjs/common';
import { ConfigThemesController }  from './config-themes.controller';
import { ConfigThemesService }     from './config-themes.service';
import { PrismaThemesRepository }  from './repository/prisma-themes.repository';
import { THEMES_REPOSITORY }       from './repository/themes.repository.interface';
import { PrismaModule }            from '../prisma/prisma.module';
import { ConfigCacheModule }       from '../config-cache/config-cache.module';
import { ConfigAuditModule }       from '../config-audit/config-audit.module';

@Module({
  imports:     [PrismaModule, ConfigCacheModule, ConfigAuditModule],
  controllers: [ConfigThemesController],
  providers:   [
    ConfigThemesService,
    { provide: THEMES_REPOSITORY, useClass: PrismaThemesRepository },
  ],
  exports:     [ConfigThemesService],
})
export class ConfigThemesModule {}
