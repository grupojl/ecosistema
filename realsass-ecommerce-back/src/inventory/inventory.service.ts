// realsass-ecommerce-back/src/inventory/inventory.service.ts
import {
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService, type PrismaTransactionClient } from "@/prisma/prisma.service.js";
import { InsufficientStockError } from "@/inventory/errors/insufficient-stock.error.js";
import {
  INVENTORY_REPOSITORY,
  type IInventoryRepository,
} from "@/inventory/repository/inventory.repository.interface.js";

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async getStock(organizationId: string, variantId: string) {
    const inv = await this.inventoryRepository.findByVariant(organizationId, variantId);
    if (!inv) throw new NotFoundException(`Inventario no encontrado para variante ${variantId}`);
    return inv;
  }

  async getBulkStock(organizationId: string, variantIds: string[]) {
    return this.inventoryRepository.findManyByVariants(organizationId, variantIds);
  }

  async setStock(organizationId: string, variantId: string, quantity: number) {
    const exists = await this.inventoryRepository.findByVariant(organizationId, variantId);
    if (!exists) throw new NotFoundException(`Inventario no encontrado para variante ${variantId}`);
    return this.inventoryRepository.setAvailable(organizationId, variantId, quantity);
  }

  async release(organizationId: string, variantId: string, quantity: number) {
    return this.inventoryRepository.release(organizationId, variantId, quantity);
  }

  // ── reserveWithinTransaction ───────────────────────────────────────────────
  // Recibe PrismaTransactionClient — el cliente tipado con todos los modelos
  // que @prisma/adapter-pg provee dentro de $transaction. Corre en la misma
  // transacción que la orden para garantizar atomicidad.

  async reserveWithinTransaction(
    tx:        PrismaTransactionClient,
    variantId: string,
    sku:       string,
    quantity:  number,
  ): Promise<void> {
    const rowsAffected = await tx.$executeRaw`
      UPDATE inventory_items
      SET    quantity_available = quantity_available - ${quantity},
             quantity_reserved  = quantity_reserved  + ${quantity}
      WHERE  variant_id = ${variantId}
        AND (quantity_available - quantity_reserved) >= ${quantity}
    `;

    if (rowsAffected === 0) {
      const current = await tx.inventoryItem.findFirst({ where: { variantId } });
      const available = current
        ? (current.quantityAvailable - current.quantityReserved)
        : 0;
      throw new InsufficientStockError(sku, quantity, available);
    }
  }
}
