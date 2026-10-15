import {
  assertValidOrderTransition,
  InvalidOrderTransitionError,
  OrderAlreadyPaidError,
  OrderNotFoundError,
  type OrderStatus,
} from '@/orders/domain/order.errors';

const ALL: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

/** La máquina de estados, escrita acá a mano e independiente de la implementación. */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PAID', 'CANCELLED'],
  PAID:      ['SHIPPED'],
  SHIPPED:   ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED:  [],
};

describe('assertValidOrderTransition (máquina de estados de órdenes)', () => {
  describe.each(ALL)('desde %s', (from) => {
    it.each(ALL)(`${'%s'} → %s`, (to) => {
      if (ALLOWED[from].includes(to)) expect(() => assertValidOrderTransition(from, to)).not.toThrow();
      else expect(() => assertValidOrderTransition(from, to)).toThrow(InvalidOrderTransitionError);
    });
  });

  it('el flujo feliz completo es válido', () => {
    const flow: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'REFUNDED'];
    for (let i = 0; i < flow.length - 1; i++) expect(() => assertValidOrderTransition(flow[i]!, flow[i + 1]!)).not.toThrow();
  });

  it('CANCELLED y REFUNDED son terminales: no se sale de ahí', () => {
    for (const to of ALL) {
      expect(() => assertValidOrderTransition('CANCELLED', to)).toThrow();
      expect(() => assertValidOrderTransition('REFUNDED', to)).toThrow();
    }
  });

  it('no se puede cancelar una orden ya pagada ni saltarse etapas', () => {
    expect(() => assertValidOrderTransition('PAID', 'CANCELLED')).toThrow();
    expect(() => assertValidOrderTransition('PENDING', 'PAID')).toThrow();
    expect(() => assertValidOrderTransition('PENDING', 'SHIPPED')).toThrow();
  });

  it('un estado desconocido nunca es válido (falla cerrado)', () => {
    expect(() => assertValidOrderTransition('INVENTADO' as OrderStatus, 'PAID')).toThrow(InvalidOrderTransitionError);
  });
});

describe('errores de orden', () => {
  it('son Error con nombre propio y mensaje útil', () => {
    const e = new InvalidOrderTransitionError('PENDING', 'PAID');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('InvalidOrderTransitionError');
    expect(e.message).toBe('Transición de estado inválida: PENDING → PAID');
    expect(new OrderNotFoundError('o-1').message).toContain('o-1');
    expect(new OrderAlreadyPaidError('o-2').message).toContain('o-2');
  });
});
