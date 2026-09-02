import { Module }                   from '@nestjs/common';
import { ConfigSecretsService }     from './config-secrets.service';
import { CryptoService }            from './crypto.service';
import { PrismaSecretsRepository }  from './repository/prisma-secrets.repository';
import { SECRETS_REPOSITORY }       from './repository/secrets.repository.interface';
import { PrismaModule }             from '../prisma/prisma.module';
import { ConfigAuditModule }        from '../config-audit/config-audit.module';

@Module({
  imports:     [PrismaModule, ConfigAuditModule],
  
  providers:   [
    ConfigSecretsService,
    CryptoService,
    { provide: SECRETS_REPOSITORY, useClass: PrismaSecretsRepository },
  ],
  exports:     [ConfigSecretsService],
})
export class ConfigSecretsModule {}
