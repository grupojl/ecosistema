import { InventoryService } from '@/inventory/inventory.service';
import { InsufficientStockError } from '@/inventory/errors/insufficient-stock.error';
import type { IInventoryRepository, InventoryRecord } from '@/inventory/repository/inventory.repository.interface';
import type { PrismaService, PrismaTransactionClient } from '@/prisma/prisma.service';

const record = (over: Partial<InventoryRecord> = {}): InventoryRecord => ({
  id: 'i-1', variantId: 'v-1', organizationId: 'org-1', quantityAvailable: 10, quantityReserved: 0, updatedAt: new Date(), ...over,
});

describe('InventoryService', () => {
  const repo = {
    findByVariant: jest.fn(), findManyByVariants: jest.fn(), setAvailable: jest.fn(), release: jest.fn(), reserve: jest.fn(),
  };
  const service = new InventoryService({} as PrismaService, repo as unknown as IInventoryRepository);
  beforeEach(() => jest.resetAllMocks());

  describe('getStock / setStock', () => {
    it('devuelve el stock si existe; si no, NotFound', async () => {
      repo.findByVariant.mockResolvedValueOnce(record());
      await expect(service.getStock('org-1', 'v-1')).resolves.toMatchObject({ quantityAvailable: 10 });

      repo.findByVariant.mockResolvedValueOnce(null);
      await expect(service.getStock('org-1', 'v-x')).rejects.toMatchObject({ status: 404 });
    });

    it('setStock solo ajusta variantes que existen, siempre dentro de la organización', async () => {
      repo.findByVariant.mockResolvedValueOnce(null);
      await expect(service.setStock('org-1', 'v-x', 5)).rejects.toMatchObject({ status: 404 });
      expect(repo.setAvailable).not.toHaveBeenCalled();

      repo.findByVariant.mockResolvedValueOnce(record());
      repo.setAvailable.mockResolvedValueOnce(record({ quantityAvailable: 5 }));
      await service.setStock('org-1', 'v-1', 5);
      expect(repo.findByVariant).toHaveBeenLastCalledWith('org-1', 'v-1');
      expect(repo.setAvailable).toHaveBeenCalledWith('org-1', 'v-1', 5);
    });

    it('getBulkStock y release delegan en el repositorio con la organización', async () => {
      repo.findManyByVariants.mockResolvedValueOnce([record()]);
      await service.getBulkStock('org-1', ['v-1']);
      expect(repo.findManyByVariants).toHaveBeenCalledWith('org-1', ['v-1']);

      await service.release('org-1', 'v-1', 2);
      expect(repo.release).toHaveBeenCalledWith('org-1', 'v-1', 2);
    });
  });

  describe('reserveWithinTransaction (corre en la misma transacción que la orden)', () => {
    const tx = (rowsAffected: number, current: Partial<InventoryRecord> | null = null) => ({
      $executeRaw: jest.fn().mockResolvedValue(rowsAffected),
      inventoryItem: { findFirst: jest.fn().mockResolvedValue(current) },
    });

    it('reserva atómicamente con un UPDATE condicionado (sin leer-y-escribir)', async () => {
      const t = tx(1);

      await expect(service.reserveWithinTransaction(t as unknown as PrismaTransactionClient, 'v-1', 'SKU-1', 3)).resolves.toBeUndefined();

      const [strings, ...values] = t.$executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(strings.join('?')).toMatch(/UPDATE inventory_items/);
      expect(strings.join('?')).toMatch(/WHERE\s+variant_id = \?/);
      // available ya es neto de reservas: el guard no puede restarle reserved otra vez (DT-Q-16)
      expect(strings.join('?')).toMatch(/AND quantity_available >= ?/);
      expect(strings.join('?')).not.toMatch(/quantity_available - quantity_reserved/);
      expect(values).toEqual([3, 3, 'v-1', 3]); // el valor viaja parametrizado: no hay SQL armado con strings
      expect(t.inventoryItem.findFirst).not.toHaveBeenCalled();
    });

    it('sin filas afectadas => InsufficientStockError con lo que realmente queda', async () => {
      const t = tx(0, { quantityAvailable: 5, quantityReserved: 2 });

      const err = await service.reserveWithinTransaction(t as unknown as PrismaTransactionClient, 'v-1', 'SKU-1', 4).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(InsufficientStockError);
      expect((err as Error).message).toMatch(/SKU-1/);
      expect((err as Error).message).toMatch(/disponibles 5/); // lo disponible es available (5), no available - reserved (3)
    });

    it('si la variante ni siquiera tiene inventario, el disponible informado es 0', async () => {
      const t = tx(0, null);
      await expect(service.reserveWithinTransaction(t as unknown as PrismaTransactionClient, 'v-1', 'SKU-1', 1)).rejects.toBeInstanceOf(InsufficientStockError);
    });
  });
});
