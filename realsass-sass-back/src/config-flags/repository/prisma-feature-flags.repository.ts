import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { IFeatureFlagsRepository } from './feature-flags.repository.interface';
import type { FeatureFlag, UpdateFeatureFlagInput } from '../domain/feature-flag.entity';

@Injectable()
export class PrismaFeatureFlagsRepository implements IFeatureFlagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOrg(organizationId: string): Promise<FeatureFlag[]> {
    const rows = await this.prisma.featureFlag.findMany({
      where: { OR: [{ organizationId }, { organizationId: null }] },
      orderBy: { key: 'asc' },
    });
    return rows as unknown as FeatureFlag[];
  }

  async findById(id: string): Promise<FeatureFlag | null> {
    return this.prisma.featureFlag.findUnique({ where: { id } }) as unknown as FeatureFlag | null;
  }

  async update(id: string, input: UpdateFeatureFlagInput): Promise<FeatureFlag> {
    return this.prisma.featureFlag.update({ where: { id }, data: input }) as unknown as FeatureFlag;
  }
}
