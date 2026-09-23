// realsass-ecommerce-back/src/inventory/inventory.service.ts
// ECO-BACK-04: refactorizado para usar IInventoryRepository.
//
// EXCEPCIÓN DOCUMENTADA (ADR-007 / ECO-BACK-04):
// reserveWithinTransaction() recibe tx: Prisma.TransactionClient porque
// orders.service.ts lo llama dentro de su $transaction de checkout.
// El UPDATE atómico necesita correr en la misma transacción que la orden.
// Todo lo demás usa IInventoryRepository.
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService }     from "@/prisma/prisma.service.js";
import { InsufficientStockError } from "@/inventory/errors/insufficient-stock.error.js";
import {
  INVENTORY_REPOSITORY,
  type IInventoryRepository,
} from "@/inventory/repository/inventory.repository.interface.js";
import type { Prisma } from "@prisma/client";

@Injectable()
export class InventoryService {
  constructor(
    // Excepción documentada: reserveWithinTransaction($tx)
    private readonly prisma: PrismaService,
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  // ── Lecturas — via repository ──────────────────────────────────────────────

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

  // ── reserveWithinTransaction — excepción documentada: recibe tx Prisma ────
  // Solo este método usa PrismaService. El $executeRaw garantiza atomicidad
  // dentro de la transacción de checkout de OrdersService.

  async reserveWithinTransaction(
    tx:        Prisma.TransactionClient,
    variantId: string,
    sku:       string,
    quantity:  number,
  ): Promise<void> {
    const rowsAffected = await tx.$executeRaw`
      UPDATE "Inventory"
      SET    "quantityAvailable" = "quantityAvailable" - ${quantity},
             "quantityReserved"  = "quantityReserved"  + ${quantity}
      WHERE  "variantId" = ${variantId}
        AND ("quantityAvailable" - "quantityReserved") >= ${quantity}
    `;

    if (rowsAffected === 0) {
      // Path de error (frío): leer stock actual solo para el mensaje
      const current = await tx.inventory.findFirst({ where: { variantId } });
      const available = current
        ? (current.quantityAvailable - current.quantityReserved)
        : 0;
      throw new InsufficientStockError(sku, quantity, available);
    }
  }
}
