import { Module }                        from '@nestjs/common';
import { ConfigFlagsController }         from './config-flags.controller';
import { ConfigFlagsService }            from './config-flags.service';
import { PrismaFeatureFlagsRepository }  from './repository/prisma-feature-flags.repository';
import { FEATURE_FLAGS_REPOSITORY }      from './repository/feature-flags.repository.interface';
import { PrismaModule }                  from '../prisma/prisma.module';
import { ConfigCacheModule }             from '../config-cache/config-cache.module';
import { ConfigAuditModule }             from '../config-audit/config-audit.module';

@Module({
  imports:     [PrismaModule, ConfigCacheModule, ConfigAuditModule],
  controllers: [ConfigFlagsController],
  providers:   [
    ConfigFlagsService,
    { provide: FEATURE_FLAGS_REPOSITORY, useClass: PrismaFeatureFlagsRepository },
  ],
  exports:     [ConfigFlagsService],
})
export class ConfigFlagsModule {}
