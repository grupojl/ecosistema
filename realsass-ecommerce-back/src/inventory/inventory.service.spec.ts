import { InventoryService } from '@/inventory/inventory.service';
import { InsufficientStockError } from '@/inventory/errors/insufficient-stock.error';

/**
 * Modelo de stock: `quantity_available` = vendible ahora; `quantity_reserved` = retenido por pedidos pendientes.
 * Reservar baja available y sube reserved. El WHERE ya NO resta lo reservado otra vez (se descontaba dos veces).
 */
function makeTx(rowsAffected: number, inventoryRow: { quantityAvailable: number; quantityReserved: number } | null = null) {
  const sql: string[] = [];
  const tx = {
    $executeRaw: jest.fn(async (strings: TemplateStringsArray) => { sql.push(strings.join('?')); return rowsAffected; }),
    inventoryItem: { findFirst: jest.fn(async () => inventoryRow) },
  };
  return { tx, sql };
}

const service = new InventoryService({} as never, {} as never);

describe('InventoryService.reserveWithinTransaction', () => {
  it('reserva: baja available, sube reserved, y exige available >= cantidad (sin restar reserved otra vez)', async () => {
    const { tx, sql } = makeTx(1);
    await service.reserveWithinTransaction(tx as never, 'v1', 'SKU-1', 2);

    const query = sql[0]!.replace(/\s+/g, ' ');
    expect(query).toContain('quantity_available = quantity_available - ?');
    expect(query).toContain('quantity_reserved = quantity_reserved + ?');
    expect(query).toContain('quantity_available >= ?');
    expect(query).not.toMatch(/quantity_available\s*-\s*quantity_reserved/);
  });

  it('sin stock suficiente → InsufficientStockError informando lo vendible (available), no available − reserved', async () => {
    const { tx } = makeTx(0, { quantityAvailable: 3, quantityReserved: 2 });
    const err = await service.reserveWithinTransaction(tx as never, 'v1', 'SKU-1', 5).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsufficientStockError);
    expect(JSON.stringify(err)).toContain('3'); // 3 vendibles (no 1 = 3 − 2)
  });

  it('variante sin registro de inventario → InsufficientStockError con 0 disponibles', async () => {
    const { tx } = makeTx(0, null);
    await expect(service.reserveWithinTransaction(tx as never, 'v1', 'SKU-1', 1)).rejects.toBeInstanceOf(InsufficientStockError);
  });
});
