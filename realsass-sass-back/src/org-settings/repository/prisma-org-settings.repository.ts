import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { toJsonObject } from '@/common/prisma/json';
import type {
  IOrgSettingsRepository,
  OrgSettingsRecord,
} from '@/org-settings/repository/org-settings.repository.interface';

@Injectable()
export class PrismaOrgSettingsRepository implements IOrgSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrg(organizationId: string): Promise<OrgSettingsRecord | null> {
    const row = await this.prisma
      .forTenant(organizationId)
      .organizationSettings.findFirst({ where: {} });
    return row
      ? { general: row.general, storefront: row.storefront, updatedAt: row.updatedAt }
      : null;
  }

  async saveGeneral(
    organizationId: string,
    general: Record<string, unknown>,
    userId: string,
  ): Promise<void> {
    const json = toJsonObject(general);
    await this.prisma.forTenant(organizationId).organizationSettings.upsert({
      where: { organizationId },
      create: { organizationId, general: json, updatedBy: userId },
      update: { general: json, updatedBy: userId },
    });
  }

  async saveStorefront(
    organizationId: string,
    storefront: Record<string, unknown>,
    userId: string,
  ): Promise<void> {
    const json = toJsonObject(storefront);
    await this.prisma.forTenant(organizationId).organizationSettings.upsert({
      where: { organizationId },
      create: { organizationId, storefront: json, updatedBy: userId },
      update: { storefront: json, updatedBy: userId },
    });
  }
}
