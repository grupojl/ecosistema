import { PrismaInventoryRepository } from '@/inventory/repository/prisma-inventory.repository';
import { InsufficientStockError } from '@/inventory/errors/insufficient-stock.error';
import type { PrismaService } from '@/prisma/prisma.service';

const record = (over: Record<string, unknown> = {}) => ({ id: 'i-1', variantId: 'v-1', quantityAvailable: 5, quantityReserved: 0, ...over });

describe('PrismaInventoryRepository (reserve / release atómicos)', () => {
  const prisma = {
    inventoryItem: { updateMany: jest.fn(), findFirst: jest.fn() },
    $executeRaw: jest.fn(),
  };
  const repo = new PrismaInventoryRepository(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  describe('reserve', () => {
    it('decide en la base con un UPDATE condicional (disponible >= cantidad) dentro de la organización', async () => {
      prisma.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
      prisma.inventoryItem.findFirst.mockResolvedValue(record({ quantityAvailable: 3, quantityReserved: 2 }));

      const out = await repo.reserve('org-1', 'v-1', 2);

      expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
        where: { variantId: 'v-1', variant: { organizationId: 'org-1' }, quantityAvailable: { gte: 2 } },
        data:  { quantityAvailable: { decrement: 2 }, quantityReserved: { increment: 2 } },
      });
      expect(out).toMatchObject({ quantityAvailable: 3, quantityReserved: 2 });
    });

    it('si no alcanza el stock (0 filas) lanza InsufficientStockError con lo disponible', async () => {
      prisma.inventoryItem.updateMany.mockResolvedValue({ count: 0 });
      prisma.inventoryItem.findFirst.mockResolvedValue(record({ quantityAvailable: 1 }));

      await expect(repo.reserve('org-1', 'v-1', 5)).rejects.toBeInstanceOf(InsufficientStockError);
    });

    it('una variante de otra organización (sin inventario visible) también es InsufficientStockError', async () => {
      prisma.inventoryItem.updateMany.mockResolvedValue({ count: 0 });
      prisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(repo.reserve('org-1', 'v-ajena', 1)).rejects.toBeInstanceOf(InsufficientStockError);
    });
  });

  describe('release', () => {
    it('libera con una sola sentencia (sin leer antes) y devuelve el inventario actualizado', async () => {
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.inventoryItem.findFirst.mockResolvedValue(record({ quantityAvailable: 6 }));

      const out = await repo.release('org-1', 'v-1', 1);

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(out.quantityAvailable).toBe(6);
    });

    it('si la variante no existe en la organización (0 filas) lanza error y no toca nada', async () => {
      prisma.$executeRaw.mockResolvedValue(0);

      await expect(repo.release('org-1', 'v-ajena', 1)).rejects.toThrow(/Inventario no encontrado/);
      expect(prisma.inventoryItem.findFirst).not.toHaveBeenCalled();
    });
  });
});
