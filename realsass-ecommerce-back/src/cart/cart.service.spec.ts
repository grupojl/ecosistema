import { NotFoundException } from '@nestjs/common';
import { CartService } from '@/cart/cart.service';
import type { CartRecord, ICartRepository } from '@/cart/repository/cart.repository.interface';

const ORG = 'org-1';
const ANA = 'cust-ana';
const BETO = 'cust-beto';
const VARIANT = 'variant-1';

/** Repositorio en memoria con las reglas que importan: organización, sesión y dueño del carrito. */
function fakeRepo() {
  const carts: CartRecord[] = [];
  let seq = 0;
  const repo: ICartRepository & { carts: CartRecord[] } = {
    carts,
    async findActiveBySession(org, sessionId) {
      return carts.find((c) => c.organizationId === org && c.sessionId === sessionId && c.status === 'ACTIVE') ?? null;
    },
    async findById(org, id) {
      return carts.find((c) => c.id === id && c.organizationId === org) ?? null;
    },
    async create(org, sessionId, customerId) {
      const cart: CartRecord = {
        id: `cart-${++seq}`, organizationId: org, sessionId, customerId: customerId ?? null,
        status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), items: [],
      };
      carts.push(cart);
      return cart;
    },
    async assignCustomer(cartId, customerId) {
      const c = carts.find((x) => x.id === cartId);
      if (c) c.customerId = customerId;
    },
    async upsertItem(cartId, variantId, quantity) {
      const c = carts.find((x) => x.id === cartId)!;
      const item = c.items.find((i) => i.variantId === variantId);
      if (item) item.quantity += quantity;
      else c.items.push({ id: `i-${++seq}`, cartId, variantId, quantity, variant: {} as never });
      return c;
    },
    async removeItem(cartId, variantId) {
      const c = carts.find((x) => x.id === cartId)!;
      c.items = c.items.filter((i) => i.variantId !== variantId);
      return c;
    },
    async complete() { /* no usado */ },
  };
  return repo;
}

function makeService() {
  const repo = fakeRepo();
  const activity = { record: jest.fn() } as never;
  return { repo, service: new CartService(repo, activity) };
}

describe('CartService — dueño del carrito', () => {
  it('agregar sin carrito crea uno CON dueño y reutiliza el de la misma sesión', async () => {
    const { repo, service } = makeService();
    const first = await service.addItem(ORG, 'sess-a', VARIANT, 1, undefined, ANA);
    const second = await service.addItem(ORG, 'sess-a', VARIANT, 2, undefined, ANA);
    expect(first.customerId).toBe(ANA);
    expect(second.id).toBe(first.id);
    expect(repo.carts).toHaveLength(1);
    expect(second.items[0]?.quantity).toBe(3);
  });

  it('otro cliente con la MISMA sesión no hereda el carrito de Ana: recibe uno propio', async () => {
    const { repo, service } = makeService();
    const ana = await service.addItem(ORG, 'sess-compartida', VARIANT, 1, undefined, ANA);
    const beto = await service.addItem(ORG, 'sess-compartida', VARIANT, 1, undefined, BETO);
    expect(beto.id).not.toBe(ana.id);
    expect(beto.customerId).toBe(BETO);
    expect(repo.carts).toHaveLength(2);
  });

  it('conocer el id del carrito de Ana NO alcanza para leerlo (404, no 403: no revela que existe)', async () => {
    const { service } = makeService();
    const cart = await service.addItem(ORG, 's1', VARIANT, 1, undefined, ANA);
    await expect(service.getCart(ORG, cart.id, BETO)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getCart(ORG, cart.id, ANA)).resolves.toMatchObject({ id: cart.id });
  });

  it('Beto no puede agregar ni quitar ítems en el carrito de Ana', async () => {
    const { repo, service } = makeService();
    const cart = await service.addItem(ORG, 's1', VARIANT, 2, undefined, ANA);
    await expect(service.addItem(ORG, 's2', VARIANT, 1, cart.id, BETO)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.removeItem(ORG, cart.id, VARIANT, BETO)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.carts[0]?.items[0]?.quantity).toBe(2);
  });

  it('un cartId inexistente falla (antes se aceptaba cualquier id)', async () => {
    const { service } = makeService();
    await expect(service.addItem(ORG, 's1', VARIANT, 1, 'no-existe', ANA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un carrito de OTRA organización es inexistente', async () => {
    const { service } = makeService();
    const cart = await service.addItem(ORG, 's1', VARIANT, 1, undefined, ANA);
    await expect(service.getCart('org-2', cart.id, ANA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un carrito anónimo anterior (sin dueño) se adopta al primer uso de un cliente', async () => {
    const { repo, service } = makeService();
    const anon = await repo.create(ORG, 'sess-vieja');
    await service.addItem(ORG, 'sess-vieja', VARIANT, 1, anon.id, ANA);
    expect(repo.carts[0]?.customerId).toBe(ANA);
  });

  it('cantidad inválida → 422', async () => {
    const { service } = makeService();
    await expect(service.addItem(ORG, 's1', VARIANT, 0, undefined, ANA)).rejects.toThrow();
  });
});
