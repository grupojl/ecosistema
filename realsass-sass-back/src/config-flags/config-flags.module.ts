import { Module }                        from '@nestjs/common';
import { ConfigFlagsService }            from '@/config-flags/config-flags.service';
import { PrismaFeatureFlagsRepository }  from '@/config-flags/repository/prisma-feature-flags.repository';
import { FEATURE_FLAGS_REPOSITORY }      from '@/config-flags/repository/feature-flags.repository.interface';
import { PrismaModule }                  from '@/prisma/prisma.module';
import { ConfigCacheModule }             from '@/config-cache/config-cache.module';
import { ConfigAuditModule }             from '@/config-audit/config-audit.module';

@Module({
  imports:     [PrismaModule, ConfigCacheModule, ConfigAuditModule],
  
  providers:   [
    ConfigFlagsService,
    { provide: FEATURE_FLAGS_REPOSITORY, useClass: PrismaFeatureFlagsRepository },
  ],
  exports:     [ConfigFlagsService],
})
export class ConfigFlagsModule {}
