import { Module }               from '@nestjs/common';
import { ConfigAuditService }    from './config-audit.service';
import { PrismaAuditRepository } from './repository/prisma-audit.repository';
import { AUDIT_REPOSITORY }      from './repository/audit.repository.interface';
import { PrismaModule }          from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  
  providers:   [
    ConfigAuditService,
    { provide: AUDIT_REPOSITORY, useClass: PrismaAuditRepository },
  ],
  exports:     [ConfigAuditService],
})
export class ConfigAuditModule {}
