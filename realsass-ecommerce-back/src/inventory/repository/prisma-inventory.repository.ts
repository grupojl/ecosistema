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
    const inv = await this.prisma.inventoryItem.findFirst({
      where: { variantId, variant: { organizationId } },
    });
    return inv;
  }

  /**
   * Reserva atómica: el UPDATE condicional decide en la base, así que dos reservas concurrentes no pueden vender la
   * misma unidad (antes: leer, comparar en memoria y escribir; entre la lectura y la escritura otro podía reservar).
   */
  async reserve(
    organizationId: string,
    variantId:      string,
    quantity:       number,
  ): Promise<InventoryRecord> {
    const { count } = await this.prisma.inventoryItem.updateMany({
      where: { variantId, variant: { organizationId }, quantityAvailable: { gte: quantity } },
      data:  { quantityAvailable: { decrement: quantity }, quantityReserved: { increment: quantity } },
    });

    const current = await this.findByVariant(organizationId, variantId);
    if (count === 0 || !current) {
      throw new InsufficientStockError(variantId, quantity, current?.quantityAvailable ?? 0);
    }
    return current;
  }

  /** Libera stock reservado, también atómico (una sola sentencia, sin leer antes). */
  async release(
    organizationId: string,
    variantId:      string,
    quantity:       number,
  ): Promise<InventoryRecord> {
    const rows = await this.prisma.$executeRaw`
      UPDATE inventory_items i
      SET    quantity_available = i.quantity_available + ${quantity},
             quantity_reserved  = GREATEST(0, i.quantity_reserved - ${quantity})
      FROM   product_variants v
      WHERE  i.variant_id = ${variantId}
        AND  v.id = i.variant_id
        AND  v.organization_id = ${organizationId}
    `;
    if (rows === 0) throw new Error(`Inventario no encontrado para variante: ${variantId}`);

    const current = await this.findByVariant(organizationId, variantId);
    if (!current) throw new Error(`Inventario no encontrado para variante: ${variantId}`);
    return current;
  }

  async setAvailable(
    organizationId: string,
    variantId:      string,
    quantity:       number,
  ): Promise<InventoryRecord> {
    const inv = await this.prisma.inventoryItem.findFirst({
      where: { variantId, variant: { organizationId } },
    });
    if (!inv) throw new Error(`Inventario no encontrado para variante: ${variantId}`);

    const updated = await this.prisma.inventoryItem.update({
      where: { id: inv.id },
      data:  { quantityAvailable: quantity },
    });
    return updated;
  }

  async findManyByVariants(
    organizationId: string,
    variantIds:     string[],
  ): Promise<InventoryRecord[]> {
    const records = await this.prisma.inventoryItem.findMany({
      where: {
        variantId: { in: variantIds },
        variant:   { organizationId },
      },
    });
    return records;
  }
}
