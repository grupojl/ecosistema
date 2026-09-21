/**
 * repository/inventory.repository.interface.ts — realsass-ecommerce-back
 *
 * Puerto (interface) para "inventory".
 * Token: INVENTORY_REPOSITORY
 *
 * Nota: InsufficientStockError ya existe en inventory/errors/.
 * Este interface lo complementa con el contrato de persistencia.
 */

export const INVENTORY_REPOSITORY = Symbol("INVENTORY_REPOSITORY");

export interface InventoryRecord {
  id:                string;
  variantId:         string;
  organizationId:    string;
  quantityAvailable: number;
  quantityReserved:  number;
  updatedAt:         Date;
}

export interface IInventoryRepository {
  /**
   * Obtiene el stock de una variante. Retorna null si no existe registro.
   */
  findByVariant(
    organizationId: string,
    variantId:      string,
  ): Promise<InventoryRecord | null>;

  /**
   * Reserva stock para una orden. Decrementa quantityAvailable.
   * Lanza InsufficientStockError si no hay stock suficiente.
   * Debe ejecutarse dentro de una transacción Prisma.
   */
  reserve(
    organizationId: string,
    variantId:      string,
    quantity:       number,
  ): Promise<InventoryRecord>;

  /**
   * Libera stock reservado (orden cancelada / fallida).
   * Incrementa quantityAvailable.
   */
  release(
    organizationId: string,
    variantId:      string,
    quantity:       number,
  ): Promise<InventoryRecord>;

  /**
   * Ajuste manual de inventario (reposición de stock).
   * Establece la cantidad disponible directamente.
   */
  setAvailable(
    organizationId: string,
    variantId:      string,
    quantity:       number,
  ): Promise<InventoryRecord>;

  /**
   * Bulk: stock de múltiples variantes de una organización.
   */
  findManyByVariants(
    organizationId: string,
    variantIds:     string[],
  ): Promise<InventoryRecord[]>;
}
