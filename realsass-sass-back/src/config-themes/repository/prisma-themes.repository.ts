import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { IThemesRepository } from './themes.repository.interface';
import type { ThemeConfig, CreateThemeInput } from '../domain/theme.entity';

type PrismaTheme = Prisma.ThemeConfigGetPayload<Record<string, never>>;

@Injectable()
export class PrismaThemesRepository implements IThemesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaTheme): ThemeConfig {
    return {
      id:              row.id,
      organizationId:  row.organizationId ?? '',
      name:            row.name,
      primaryColor:    row.primaryColor,
      secondaryColor:  row.secondaryColor,
      accentColor:     row.accentColor,
      fontFamily:      row.fontFamily,
      borderRadius:    row.borderRadius,
      logoUrl:         row.logoUrl,
      faviconUrl:      row.faviconUrl,
      darkMode:        row.darkMode,
      customCSS:       row.customCSS,
      isSystemDefault: row.isSystemDefault,
      isActive:        row.isActive,
      createdAt:       row.createdAt,
      updatedAt:       row.updatedAt,
    };
  }

  async findAllByOrg(organizationId: string): Promise<ThemeConfig[]> {
    const rows = await this.prisma.themeConfig.findMany({
      where: { organizationId }, orderBy: { createdAt: 'asc' },
    });
    return rows.map(r => this.toEntity(r));
  }

  async findById(id: string): Promise<ThemeConfig | null> {
    const row = await this.prisma.themeConfig.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findActive(organizationId: string): Promise<ThemeConfig | null> {
    const row = await this.prisma.themeConfig.findFirst({ where: { organizationId, isActive: true } });
    return row ? this.toEntity(row) : null;
  }

  async findPublicByOrgId(organizationId: string): Promise<ThemeConfig | null> {
    const row = await this.prisma.themeConfig.findFirst({ where: { organizationId, isActive: true } });
    return row ? this.toEntity(row) : null;
  }

  async create(input: CreateThemeInput): Promise<ThemeConfig> {
    const row = await this.prisma.themeConfig.create({
      data: { ...input, isActive: false },
    });
    return this.toEntity(row);
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
