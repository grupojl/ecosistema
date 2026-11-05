/**
 * municipality.service.ts — el municipio como organización (welver-domain.md §15.2 «Municipio»).
 *
 * Extiende `Organization` con población, plantilla de organigrama y retención de datos. El tramo NO se guarda: se
 * deriva de la población. La región de datos y el país los fija la plataforma al crear (ADR-031) y no se editan acá.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigAuditService } from '@/config-audit/config-audit.service';
import {
  isValidPopulation,
  tierForPopulation,
  type Tier,
} from '@/welver/domain/tiers';
import {
  isTemplateKey,
  suggestedTemplateForTier,
  type TemplateKey,
} from '@/welver/domain/org-chart-templates';

export const RETENTION_DAYS_DEFAULT = 90;
/** Cotas razonables hasta que la tabla de políticas por país (ADR-031) fije mínimos y máximos legales. */
export const RETENTION_DAYS_MIN = 1;
export const RETENTION_DAYS_MAX = 3650;

export interface MunicipalityView {
  id: string;
  name: string | null;
  countryCode: string;
  dataRegion: string;
  population: number | null;
  tier: Tier | null;
  orgChartTemplate: TemplateKey | null;
  suggestedTemplate: TemplateKey | null;
  dataRetentionDays: number;
}

export interface UpdateMunicipalityInput {
  population?: number;
  orgChartTemplate?: TemplateKey;
  dataRetentionDays?: number;
}

@Injectable()
export class MunicipalityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ConfigAuditService,
  ) {}

  async get(organizationId: string): Promise<MunicipalityView> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        countryCode: true,
        dataRegion: true,
        population: true,
        orgChartTemplate: true,
        dataRetentionDays: true,
      },
    });
    if (!org) throw new NotFoundException('Municipio no encontrado');
    const tier = isValidPopulation(org.population)
      ? tierForPopulation(org.population)
      : null;
    return {
      id: org.id,
      name: org.name,
      countryCode: org.countryCode,
      dataRegion: org.dataRegion,
      population: org.population,
      tier,
      orgChartTemplate:
        org.orgChartTemplate && isTemplateKey(org.orgChartTemplate)
          ? org.orgChartTemplate
          : null,
      suggestedTemplate: tier ? suggestedTemplateForTier(tier) : null,
      dataRetentionDays: org.dataRetentionDays,
    };
  }

  async update(
    organizationId: string,
    uid: string,
    input: UpdateMunicipalityInput,
  ): Promise<MunicipalityView> {
    const before = await this.get(organizationId);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(input.population !== undefined && { population: input.population }),
        ...(input.orgChartTemplate !== undefined && {
          orgChartTemplate: input.orgChartTemplate,
        }),
        ...(input.dataRetentionDays !== undefined && {
          dataRetentionDays: input.dataRetentionDays,
        }),
      },
    });
    const after = await this.get(organizationId);
    this.audit.log({
      organizationId,
      userId: uid,
      configType: 'municipality',
      configKey: 'profile',
      action: 'update',
      diff: {
        population: [before.population, after.population],
        orgChartTemplate: [before.orgChartTemplate, after.orgChartTemplate],
        dataRetentionDays: [before.dataRetentionDays, after.dataRetentionDays],
      },
    });
    return after;
  }
}
