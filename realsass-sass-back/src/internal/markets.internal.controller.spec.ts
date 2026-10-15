import { BadRequestException } from '@nestjs/common';
import { MarketsInternalController } from '@/internal/markets.internal.controller';
import type { MarketsService } from '@/markets/markets.service';
import { currentTenantScope, type TenantScope } from '@/prisma/tenant-context';

const ORG = '00000000-0000-4000-8000-000000000001';

describe('MarketsInternalController', () => {
  const markets = { list: jest.fn() };
  const controller = new MarketsInternalController(markets as unknown as MarketsService);

  beforeEach(() => jest.resetAllMocks());

  it('lista los mercados dentro del alcance de la organización de la URL (ADR-027)', async () => {
    let scope: TenantScope | null = null;
    markets.list.mockImplementation(() => { scope = currentTenantScope(); return Promise.resolve([]); });

    await controller.getMarkets(ORG);

    expect(markets.list).toHaveBeenCalledWith(ORG);
    expect(scope).toEqual({ kind: 'tenant', organizationId: ORG });
  });

  it('un id que no es UUID responde 400 y no toca el service', () => {
    expect(() => controller.getMarkets('no-es-uuid')).toThrow(BadRequestException);
    expect(markets.list).not.toHaveBeenCalled();
  });
});
