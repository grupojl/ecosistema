import { Module }                  from '@nestjs/common';
import { ConfigQuotasService }     from './config-quotas.service';
import { PrismaQuotasRepository }  from './repository/prisma-quotas.repository';
import { QUOTAS_REPOSITORY }       from './repository/quotas.repository.interface';
import { PrismaModule }            from '../prisma/prisma.module';
import { ConfigCacheModule }       from '../config-cache/config-cache.module';
import { ConfigAuditModule }       from '../config-audit/config-audit.module';

@Module({
  imports:     [PrismaModule, ConfigCacheModule, ConfigAuditModule],
  
  providers:   [
    ConfigQuotasService,
    { provide: QUOTAS_REPOSITORY, useClass: PrismaQuotasRepository },
  ],
  exports:     [ConfigQuotasService],
})
export class ConfigQuotasModule {}
