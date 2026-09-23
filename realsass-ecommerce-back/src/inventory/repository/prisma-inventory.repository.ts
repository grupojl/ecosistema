/**
 * repository/prisma-inventory.repository.ts — realsass-ecommerce-back
 *
 * Adaptador concreto de IInventoryRepository usando Prisma.
 * ÚNICO archivo del módulo inventory que puede importar PrismaService.
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import type { IInventoryRepository, InventoryRecord } from "@/inventory/repository/inventory.repository.interface";
import { InsufficientStockError } from "@/errors/insufficient-stock.error";

@Injectable()
export class PrismaInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByVariant(
    organizationId: string,
    variantId:      string,
  ): Promise<InventoryRecord | null> {
    const inv = await this.prisma.inventory.findFirst({
      where: { variantId, variant: { organizationId } },
    });
    return inv as InventoryRecord | null;
  }

  async reserve(
    organizationId: string,
    variantId:      string,
    quantity:       number,
  ): Promise<InventoryRecord> {
    const inv = await this.prisma.inventory.findFirst({
      where: { variantId, variant: { organizationId } },
    });

    if (!inv || inv.quantityAvailable < quantity) {
      throw new InsufficientStockError(variantId, quantity, inv?.quantityAvailable ?? 0);
    }

    const updated = await this.prisma.inventory.update({
      where: { id: inv.id },
      data:  {
        quantityAvailable: inv.quantityAvailable - quantity,
        quantityReserved:  inv.quantityReserved  + quantity,
      },
    });
    return updated as InventoryRecord;
  }

  async release(
    organizationId: string,
    variantId:      string,
    quantity:       number,
  ): Promise<InventoryRecord> {
    const inv = await this.prisma.inventory.findFirst({
      where: { variantId, variant: { organizationId } },
    });
    if (!inv) throw new Error(`Inventario no encontrado para variante: ${variantId}`);

    const updated = await this.prisma.inventory.update({
      where: { id: inv.id },
      data:  {
        quantityAvailable: inv.quantityAvailable + quantity,
        quantityReserved:  Math.max(0, inv.quantityReserved - quantity),
      },
    });
    return updated as InventoryRecord;
  }

  async setAvailable(
    organizationId: string,
    variantId:      string,
    quantity:       number,
  ): Promise<InventoryRecord> {
    const inv = await this.prisma.inventory.findFirst({
      where: { variantId, variant: { organizationId } },
    });
    if (!inv) throw new Error(`Inventario no encontrado para variante: ${variantId}`);

    const updated = await this.prisma.inventory.update({
      where: { id: inv.id },
      data:  { quantityAvailable: quantity },
    });
    return updated as InventoryRecord;
  }

  async findManyByVariants(
    organizationId: string,
    variantIds:     string[],
  ): Promise<InventoryRecord[]> {
    const records = await this.prisma.inventory.findMany({
      where: {
        variantId: { in: variantIds },
        variant:   { organizationId },
      },
    });
    return records as InventoryRecord[];
  }
}
