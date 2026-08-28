import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { IThemesRepository } from './themes.repository.interface';
import type { ThemeConfig, CreateThemeInput } from '../domain/theme.entity';

@Injectable()
export class PrismaThemesRepository implements IThemesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOrg(organizationId: string): Promise<ThemeConfig[]> {
    return this.prisma.themeConfig.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } }) as unknown as ThemeConfig[];
  }

  async findById(id: string): Promise<ThemeConfig | null> {
    return this.prisma.themeConfig.findUnique({ where: { id } }) as unknown as ThemeConfig | null;
  }

  async findActive(organizationId: string): Promise<ThemeConfig | null> {
    return this.prisma.themeConfig.findFirst({ where: { organizationId, isActive: true } }) as unknown as ThemeConfig | null;
  }

  async findPublicByOrgId(organizationId: string): Promise<ThemeConfig | null> {
    return this.prisma.themeConfig.findFirst({
      where: { organizationId, isActive: true },
    }) as unknown as ThemeConfig | null;
  }

  async create(input: CreateThemeInput): Promise<ThemeConfig> {
    return this.prisma.themeConfig.create({ data: { ...input, isActive: false } }) as unknown as ThemeConfig;
  }

  async activate(id: string, organizationId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.themeConfig.updateMany({ where: { organizationId }, data: { isActive: false } }),
      this.prisma.themeConfig.update({ where: { id }, data: { isActive: true } }),
    ]);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.themeConfig.delete({ where: { id } });
  }
}
