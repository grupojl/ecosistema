import { Injectable }       from '@nestjs/common'
import { PrismaService }    from '@/prisma/prisma.service'
import { Market, FulfillmentConfigSchema, type FulfillmentConfig } from '@/domain/market.entity'
import type { IMarketRepository } from '@/markets/repository/market.repository.interface'

@Injectable()
export class PrismaMarketRepository implements IMarketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<Market[]> {
    const rows = await this.prisma.market.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
    return rows.map(Market.fromPrisma)
  }

  async findActive(organizationId: string, countryCode: string): Promise<Market | null> {
    const row = await this.prisma.market.findFirst({
      where: { organizationId, countryCode: countryCode.toUpperCase(), isActive: true },
    })
    return row ? Market.fromPrisma(row) : null
  }

  async findDefault(organizationId: string): Promise<Market | null> {
    const row = await this.prisma.market.findFirst({
      where: { organizationId, isDefault: true },
    })
    return row ? Market.fromPrisma(row) : null
  }

  async findById(id: string): Promise<Market | null> {
    const row = await this.prisma.market.findUnique({ where: { id } })
    return row ? Market.fromPrisma(row) : null
  }

  async create(data: {
    organizationId:    string
    countryCode:       string
    isDefault:         boolean
    fulfillmentConfig: FulfillmentConfig
  }): Promise<Market> {
    // Validar fulfillmentConfig antes de persistir — nunca raw en DB
    const config = FulfillmentConfigSchema.parse(data.fulfillmentConfig)
    const row = await this.prisma.market.create({
      data: {
        organizationId:    data.organizationId,
        countryCode:       data.countryCode.toUpperCase(),
        isDefault:         data.isDefault,
        isActive:          true,
        fulfillmentConfig: config as object,
      },
    })
    return Market.fromPrisma(row)
  }

  async update(id: string, data: { isActive?: boolean; fulfillmentConfig?: FulfillmentConfig }): Promise<Market> {
    const updateData: Record<string, unknown> = {}
    if (data.isActive !== undefined)          updateData['isActive']          = data.isActive
    if (data.fulfillmentConfig !== undefined) updateData['fulfillmentConfig'] = FulfillmentConfigSchema.parse(data.fulfillmentConfig) as object
    const row = await this.prisma.market.update({ where: { id }, data: updateData })
    return Market.fromPrisma(row)
  }

  async setDefault(id: string, organizationId: string): Promise<Market> {
    const [, updated] = await this.prisma.$transaction([
      this.prisma.market.updateMany({
        where: { organizationId, isDefault: true },
        data:  { isDefault: false },
      }),
      this.prisma.market.update({
        where: { id },
        data:  { isDefault: true, isActive: true },
      }),
    ])
    return Market.fromPrisma(updated)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.market.delete({ where: { id } })
  }
}
