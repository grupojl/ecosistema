import { Module } from '@nestjs/common';
import { OrgSettingsService } from '@/org-settings/org-settings.service';
import { PrismaOrgSettingsRepository } from '@/org-settings/repository/prisma-org-settings.repository';
import { ORG_SETTINGS_REPOSITORY } from '@/org-settings/repository/org-settings.repository.interface';
import { PrismaModule } from '@/prisma/prisma.module';
import { ConfigAuditModule } from '@/config-audit/config-audit.module';

@Module({
  imports: [PrismaModule, ConfigAuditModule],
  providers: [
    OrgSettingsService,
    { provide: ORG_SETTINGS_REPOSITORY, useClass: PrismaOrgSettingsRepository },
  ],
  exports: [OrgSettingsService],
})
export class OrgSettingsModule {}
