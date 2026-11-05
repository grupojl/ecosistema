import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { ConfigAuditModule } from '@/config-audit/config-audit.module';
import { MunicipalityService } from '@/welver/municipality/municipality.service';
import { SubscriptionService } from '@/welver/subscription/subscription.service';
import {
  EntityAccessService,
  EntityPermissionsService,
} from '@/welver/entity-access/entity-access.service';
import { OrgChartService } from '@/welver/org-chart/org-chart.service';
import { KnowledgeService } from '@/welver/knowledge/knowledge.service';
import { MandatesService } from '@/welver/mandates/mandates.service';
import { ChannelsService } from '@/welver/channels/channels.service';
import { QualityService } from '@/welver/quality/quality.service';
import { GapsService } from '@/welver/gaps/gaps.service';
import { ApiAccessService } from '@/welver/api-access/api-access.service';

/**
 * Welver — atención al ciudadano con IA para municipios (.claude/domain/welver-domain.md).
 * Vive dentro de sass-back: un municipio es una Organization (ecosystemId = "welver").
 */
const SERVICES = [
  MunicipalityService,
  SubscriptionService,
  EntityAccessService,
  EntityPermissionsService,
  OrgChartService,
  KnowledgeService,
  MandatesService,
  ChannelsService,
  QualityService,
  GapsService,
  ApiAccessService,
];

@Module({
  imports: [PrismaModule, ConfigAuditModule],
  providers: SERVICES,
  exports: SERVICES,
})
export class WelverModule {}
