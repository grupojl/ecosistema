import { Module }                   from '@nestjs/common';
import { ConfigSecretsService }     from '@/config-secrets/config-secrets.service';
import { CryptoService }            from '@/config-secrets/crypto.service';
import { PrismaSecretsRepository }  from '@/config-secrets/repository/prisma-secrets.repository';
import { SECRETS_REPOSITORY }       from '@/config-secrets/repository/secrets.repository.interface';
import { PrismaModule }             from '@/prisma/prisma.module';
import { ConfigAuditModule }        from '@/config-audit/config-audit.module';

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
