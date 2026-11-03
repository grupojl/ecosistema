import { NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InsufficientStockError } from './errors/insufficient-stock.error';

const make = () => {
  const repo = { findByVariant: jest.fn(), findManyByVariants: jest.fn(), setAvailable: jest.fn(), release: jest.fn() };
  return { svc: new InventoryService({} as never, repo as never), repo };
};

describe('InventoryService: consulta, ajuste y reserva', () => {
  it('getStock: stock de la variante o 404', async () => {
    const { svc, repo } = make();
    repo.findByVariant.mockResolvedValueOnce(null).mockResolvedValueOnce({ quantityAvailable: 4 });
    await expect(svc.getStock('org', 'v1')).rejects.toBeInstanceOf(NotFoundException);
    expect(await svc.getStock('org', 'v1')).toEqual({ quantityAvailable: 4 });
    expect(repo.findByVariant).toHaveBeenCalledWith('org', 'v1');
  });

  it('getBulkStock consulta varias variantes de la organización', async () => {
    const { svc, repo } = make();
    repo.findManyByVariants.mockResolvedValue([1, 2]);
    expect(await svc.getBulkStock('org', ['a', 'b'])).toEqual([1, 2]);
    expect(repo.findManyByVariants).toHaveBeenCalledWith('org', ['a', 'b']);
  });

  it('setStock: 404 si la variante no tiene inventario (no lo crea a ciegas); ajusta si existe', async () => {
    const { svc, repo } = make();
    repo.findByVariant.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'i' });
    await expect(svc.setStock('org', 'v1', 10)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.setAvailable).not.toHaveBeenCalled();
    repo.setAvailable.mockResolvedValue({ quantityAvailable: 10 });
    expect(await svc.setStock('org', 'v1', 10)).toEqual({ quantityAvailable: 10 });
    expect(repo.setAvailable).toHaveBeenCalledWith('org', 'v1', 10);
  });

  it('release devuelve la cantidad al stock vendible de esa organización', async () => {
    const { svc, repo } = make();
    await svc.release('org', 'v1', 2);
    expect(repo.release).toHaveBeenCalledWith('org', 'v1', 2);
  });

  describe('reserveWithinTransaction', () => {
    const tx = (rows: number, current: { quantityAvailable: number } | null = null) => ({
      $executeRaw: jest.fn().mockResolvedValue(rows),
      inventoryItem: { findFirst: jest.fn().mockResolvedValue(current) },
    });

    it('reserva cuando el UPDATE condicionado afectó una fila', async () => {
      const { svc } = make();
      const t = tx(1);
      await expect(svc.reserveWithinTransaction(t as never, 'v1', 'sku', 2)).resolves.toBeUndefined();
      expect(t.inventoryItem.findFirst).not.toHaveBeenCalled();
    });

    it('sin stock suficiente lanza InsufficientStockError con lo disponible', async () => {
      const { svc } = make();
      const err = await svc
        .reserveWithinTransaction(tx(0, { quantityAvailable: 1 }) as never, 'v1', 'sku-9', 3)
        .catch((e) => e);
      expect(err).toBeInstanceOf(InsufficientStockError);
      expect(err.message).toContain('sku-9');
    });

    it('una variante sin fila de inventario cuenta como 0 disponible', async () => {
      const { svc } = make();
      await expect(svc.reserveWithinTransaction(tx(0, null) as never, 'v1', 'sku', 1)).rejects.toBeInstanceOf(
        InsufficientStockError,
      );
    });
  });
});
