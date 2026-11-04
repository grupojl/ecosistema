import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

const make = () => {
  const repo = {
    findById: jest.fn(),
    findByCart: jest.fn(),
    findByCustomer: jest.fn(),
    updateStatus: jest.fn(),
    setPaymentIntent: jest.fn(),
  };
  const svc = new OrdersService({} as never, repo as never, {} as never, {} as never, {} as never, {} as never);
  return { svc, repo };
};

describe('OrdersService: lecturas y estado', () => {
  it('findById: orden de la organización o 404', async () => {
    const { svc, repo } = make();
    repo.findById.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'o1' });
    await expect(svc.findById('org', 'o1')).rejects.toBeInstanceOf(NotFoundException);
    expect(await svc.findById('org', 'o1')).toEqual({ id: 'o1' });
    expect(repo.findById).toHaveBeenCalledWith('org', 'o1');
  });

  it('getOrder devuelve null si no existe (sin lanzar)', async () => {
    const { svc, repo } = make();
    repo.findById.mockResolvedValue(null);
    expect(await svc.getOrder('org', 'o1')).toBeNull();
  });

  it('listByCustomer y listBySession consultan por cliente / carrito dentro de la organización', async () => {
    const { svc, repo } = make();
    repo.findByCustomer.mockResolvedValue([1]);
    repo.findByCart.mockResolvedValue([2]);
    expect(await svc.listByCustomer('org', 'c1')).toEqual([1]);
    expect(await svc.listBySession('org', 's1')).toEqual([2]);
    expect(repo.findByCustomer).toHaveBeenCalledWith('org', 'c1');
    expect(repo.findByCart).toHaveBeenCalledWith('org', 's1');
  });

  it('listOrders con y sin sesión', async () => {
    const { svc, repo } = make();
    await svc.listOrders('org', 's1');
    await svc.listOrders('org');
    expect(repo.findByCart.mock.calls).toEqual([['org', 's1'], ['org', '']]);
  });

  describe('updateStatus (máquina de estados)', () => {
    it('404 si la orden no existe', async () => {
      const { svc, repo } = make();
      repo.findById.mockResolvedValue(null);
      await expect(svc.updateStatus('org', 'o1', 'PAID')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('aplica una transición válida', async () => {
      const { svc, repo } = make();
      repo.findById.mockResolvedValue({ id: 'o1', status: 'PAID' });
      repo.updateStatus.mockResolvedValue({ id: 'o1', status: 'FULFILLING' });
      expect(await svc.updateStatus('org', 'o1', 'FULFILLING')).toEqual({ id: 'o1', status: 'FULFILLING' });
      expect(repo.updateStatus).toHaveBeenCalledWith('org', 'o1', 'FULFILLING');
    });

    it.each([
      ['PENDING_PAYMENT', 'SHIPPED'],
      ['PAID', 'CANCELLED'],
      ['DELIVERED', 'PAID'],
      ['CANCELLED', 'PAID'],
    ] as const)('rechaza con 400 la transición inválida %s → %s y no escribe', async (from, to) => {
      const { svc, repo } = make();
      repo.findById.mockResolvedValue({ id: 'o1', status: from });
      await expect(svc.updateStatus('org', 'o1', to)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('setPaymentIntent', () => {
    it('404 si la orden no es de la organización', async () => {
      const { svc, repo } = make();
      repo.findById.mockResolvedValue(null);
      await expect(svc.setPaymentIntent('org', 'o1', 'pi_1')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.setPaymentIntent).not.toHaveBeenCalled();
    });

    it('asocia el intento de pago', async () => {
      const { svc, repo } = make();
      repo.findById.mockResolvedValue({ id: 'o1' });
      await svc.setPaymentIntent('org', 'o1', 'pi_1');
      expect(repo.setPaymentIntent).toHaveBeenCalledWith('org', 'o1', 'pi_1');
    });
  });
});
