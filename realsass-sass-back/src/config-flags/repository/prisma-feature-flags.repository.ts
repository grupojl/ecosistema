import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { IFeatureFlagsRepository } from './feature-flags.repository.interface';
import type { FeatureFlag, UpdateFeatureFlagInput } from '../domain/feature-flag.entity';

type PrismaFlag = Prisma.FeatureFlagGetPayload<Record<string, never>>;

@Injectable()
export class PrismaFeatureFlagsRepository implements IFeatureFlagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaFlag): FeatureFlag {
    return {
      id:                row.id,
      organizationId:    row.organizationId,
      key:               row.key,
      enabled:           row.enabled,
      description:       row.description,
      rolloutPercentage: row.rolloutPercentage,
      // @real/jsonb-cast — Prisma devuelve JsonValue para campos Json
      conditions:        row.conditions as Record<string, unknown>,
      createdAt:         row.createdAt,
      updatedAt:         row.updatedAt,
    };
  }

  async findAllByOrg(organizationId: string): Promise<FeatureFlag[]> {
    const rows = await this.prisma.featureFlag.findMany({
      where: { OR: [{ organizationId }, { organizationId: null }] },
      orderBy: { key: 'asc' },
    });
    return rows.map(r => this.toEntity(r));
  }

  async findById(id: string): Promise<FeatureFlag | null> {
    const row = await this.prisma.featureFlag.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async update(id: string, input: UpdateFeatureFlagInput): Promise<FeatureFlag> {
    const row = await this.prisma.featureFlag.update({ where: { id }, data: input });
    return this.toEntity(row);
  }
}
