import {
  assertValidQuantity, CartItemNotFoundError, CartNotFoundError, InsufficientStockForCartError, InvalidQuantityError,
} from '@/cart/domain/cart.errors';

describe('assertValidQuantity', () => {
  it.each([1, 2, 10, 9999])('acepta enteros positivos (%s)', (q) => {
    expect(() => assertValidQuantity(q)).not.toThrow();
  });

  it.each([0, -1, -100, 1.5, 0.1, NaN, Infinity])('rechaza %s', (q) => {
    expect(() => assertValidQuantity(q)).toThrow(InvalidQuantityError);
  });
});

describe('errores del carrito', () => {
  it('llevan nombre propio, son Error y dicen qué falló', () => {
    expect(new CartNotFoundError('c-1')).toMatchObject({ name: 'CartNotFoundError', message: 'Carrito no encontrado: c-1' });
    expect(new CartItemNotFoundError('v-1').message).toContain('v-1');
    expect(new InvalidQuantityError(0)).toBeInstanceOf(Error);
    const stock = new InsufficientStockForCartError('v-9', 5, 2);
    expect(stock.message).toContain('solicitado 5');
    expect(stock.message).toContain('disponible 2');
  });
});
