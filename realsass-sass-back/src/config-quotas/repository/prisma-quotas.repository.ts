import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { IQuotasRepository } from './quotas.repository.interface';
import type { QuotaConfig } from '../domain/quota.entity';

@Injectable()
export class PrismaQuotasRepository implements IQuotasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOrg(organizationId: string): Promise<QuotaConfig[]> {
    return this.prisma.quotaConfig.findMany({ where: { organizationId } }) as unknown as QuotaConfig[];
  }

  async findByResource(organizationId: string, resource: string): Promise<QuotaConfig | null> {
    return this.prisma.quotaConfig.findFirst({ where: { organizationId, resource } }) as unknown as QuotaConfig | null;
  }

  async increment(organizationId: string, resource: string, delta: number): Promise<void> {
    await this.prisma.quotaConfig.updateMany({
      where: { organizationId, resource },
      data:  { currentUsage: { increment: delta } },
    });
  }

  async updateLimit(organizationId: string, resource: string, limit: number): Promise<QuotaConfig> {
    return this.prisma.quotaConfig.upsert({
      where:  { organizationId_resource: { organizationId, resource } },
      update: { limit },
      create: { organizationId, resource, limit, currentUsage: 0 },
    }) as unknown as QuotaConfig;
  }
}
