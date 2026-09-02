import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { IQuotasRepository } from './quotas.repository.interface';
import type { QuotaConfig } from '../domain/quota.entity';

type PrismaQuota = Prisma.QuotaConfigGetPayload<Record<string, never>>;

@Injectable()
export class PrismaQuotasRepository implements IQuotasRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaQuota): QuotaConfig {
    return {
      id:             row.id,
      organizationId: row.organizationId,
      resource:       row.resource,
      limit:          row.limit,
      currentUsage:   row.currentUsage,
      createdAt:      row.createdAt,
      updatedAt:      row.updatedAt,
    };
  }

  async findAllByOrg(organizationId: string): Promise<QuotaConfig[]> {
    const rows = await this.prisma.quotaConfig.findMany({ where: { organizationId } });
    return rows.map(r => this.toEntity(r));
  }

  async findByResource(organizationId: string, resource: string): Promise<QuotaConfig | null> {
    const row = await this.prisma.quotaConfig.findFirst({ where: { organizationId, resource } });
    return row ? this.toEntity(row) : null;
  }

  async increment(organizationId: string, resource: string, delta: number): Promise<void> {
    await this.prisma.quotaConfig.updateMany({
      where: { organizationId, resource },
      data:  { currentUsage: { increment: delta } },
    });
  }

  async updateLimit(organizationId: string, resource: string, limit: number): Promise<QuotaConfig> {
    const row = await this.prisma.quotaConfig.upsert({
      where:  { organizationId_resource: { organizationId, resource } },
      update: { limit },
      create: { organizationId, resource, limit, currentUsage: 0 },
    });
    return this.toEntity(row);
  }
}
