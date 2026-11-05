/**
 * Cableado de Nest: todos los servicios de Welver se pueden construir con las dependencias que declara el módulo.
 * Un proveedor que falta solo explota al arrancar la app; acá explota en el test.
 */
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigAuditService } from '@/config-audit/config-audit.service';
import { WelverModule } from '@/welver/welver.module';
import { MunicipalityService } from '@/welver/municipality/municipality.service';
import { SubscriptionService } from '@/welver/subscription/subscription.service';
import { EntityAccessService, EntityPermissionsService } from '@/welver/entity-access/entity-access.service';
import { OrgChartService } from '@/welver/org-chart/org-chart.service';
import { KnowledgeService } from '@/welver/knowledge/knowledge.service';
import { MandatesService } from '@/welver/mandates/mandates.service';
import { ChannelsService } from '@/welver/channels/channels.service';
import { QualityService } from '@/welver/quality/quality.service';
import { GapsService } from '@/welver/gaps/gaps.service';
import { ApiAccessService } from '@/welver/api-access/api-access.service';

describe('WelverModule', () => {
  it('resuelve cada servicio con sus dependencias', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [EventEmitterModule.forRoot(), WelverModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ConfigAuditService)
      .useValue({ log: jest.fn() })
      .compile();

    for (const token of [
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
    ]) {
      expect(moduleRef.get(token)).toBeInstanceOf(token);
    }
  });
});
