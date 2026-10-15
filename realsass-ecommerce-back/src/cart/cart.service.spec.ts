import { CartService } from '@/cart/cart.service';
import type { CartRecord, ICartRepository } from '@/cart/repository/cart.repository.interface';

const cart = (over: Partial<CartRecord> = {}): CartRecord => ({
  id: 'cart-1', organizationId: 'org-1', sessionId: 'cust-1', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(),
  items: [{ id: 'i-1', cartId: 'cart-1', variantId: 'v-1', quantity: 1 } as CartRecord['items'][number]],
  ...over,
});

describe('CartService', () => {
  const repo = {
    findActiveBySession: jest.fn(), findById: jest.fn(), create: jest.fn(), upsertItem: jest.fn(), removeItem: jest.fn(), complete: jest.fn(),
  };
  const service = new CartService(repo as unknown as ICartRepository, { record: jest.fn() } as never);
  beforeEach(() => jest.resetAllMocks());

  describe('getOwnedCart (IDOR: solo el dueño ve su carrito)', () => {
    it('devuelve el carrito si su sessionId es el customerId', async () => {
      repo.findById.mockResolvedValue(cart());
      await expect(service.getOwnedCart('org-1', 'cart-1', 'cust-1')).resolves.toMatchObject({ id: 'cart-1' });
    });

    it('otro cliente => el MISMO NotFound que si no existiera (sin oráculo de existencia)', async () => {
      repo.findById.mockResolvedValueOnce(cart());
      const ajeno = await service.getOwnedCart('org-1', 'cart-1', 'otro').catch((e: unknown) => e);
      repo.findById.mockResolvedValueOnce(null);
      const inexistente = await service.getOwnedCart('org-1', 'cart-1', 'cust-1').catch((e: unknown) => e);

      expect(ajeno).toMatchObject({ status: 404 });
      expect((ajeno as Error).message).toBe((inexistente as Error).message);
    });

    it('busca siempre acotado a la organización', async () => {
      repo.findById.mockResolvedValue(null);
      await service.getOwnedCart('org-9', 'cart-1', 'cust-1').catch(() => undefined);
      expect(repo.findById).toHaveBeenCalledWith('org-9', 'cart-1');
    });
  });

  describe('addItem', () => {
    it.each([0, -1, 1.5, NaN])('rechaza la cantidad %s (422) sin tocar el carrito', async (q) => {
      await expect(service.addItem('org-1', 'cust-1', 'v-1', q)).rejects.toMatchObject({ status: 422 });
      expect(repo.upsertItem).not.toHaveBeenCalled();
    });

    it('crea el carrito de la sesión si no existe y agrega la variante', async () => {
      repo.findActiveBySession.mockResolvedValue(null);
      repo.create.mockResolvedValue(cart({ id: 'nuevo', items: [] }));
      repo.upsertItem.mockResolvedValue(cart({ id: 'nuevo' }));

      await service.addItem('org-1', 'cust-1', 'v-1', 2);

      expect(repo.create).toHaveBeenCalledWith('org-1', 'cust-1');
      expect(repo.upsertItem).toHaveBeenCalledWith('nuevo', 'v-1', 2);
    });

    it('reutiliza el carrito activo de la sesión', async () => {
      repo.findActiveBySession.mockResolvedValue(cart());
      repo.upsertItem.mockResolvedValue(cart());
      await service.addItem('org-1', 'cust-1', 'v-1', 1);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.upsertItem).toHaveBeenCalledWith('cart-1', 'v-1', 1);
    });

    it('con un cartId explícito verifica que sea del cliente ANTES de modificarlo', async () => {
      repo.findById.mockResolvedValue(cart({ sessionId: 'otro' }));
      await expect(service.addItem('org-1', 'cust-1', 'v-1', 1, 'cart-1')).rejects.toMatchObject({ status: 404 });
      expect(repo.upsertItem).not.toHaveBeenCalled();
    });
  });

  describe('removeItem / completeCart', () => {
    it('quita una variante que está en el carrito', async () => {
      repo.findById.mockResolvedValue(cart());
      repo.removeItem.mockResolvedValue(cart({ items: [] }));
      await service.removeItem('org-1', 'cart-1', 'v-1');
      expect(repo.removeItem).toHaveBeenCalledWith('cart-1', 'v-1');
    });

    it('NotFound si el carrito no existe o la variante no está', async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(service.removeItem('org-1', 'cart-x', 'v-1')).rejects.toMatchObject({ status: 404 });
      repo.findById.mockResolvedValueOnce(cart());
      await expect(service.removeItem('org-1', 'cart-1', 'v-otra')).rejects.toMatchObject({ status: 404 });
      expect(repo.removeItem).not.toHaveBeenCalled();
    });

    it('completeCart marca el carrito; NotFound si no existe en la organización', async () => {
      repo.findById.mockResolvedValueOnce(cart());
      await service.completeCart('org-1', 'cart-1');
      expect(repo.complete).toHaveBeenCalledWith('cart-1');

      repo.findById.mockResolvedValueOnce(null);
      await expect(service.completeCart('org-1', 'cart-x')).rejects.toMatchObject({ status: 404 });
    });
  });
});
