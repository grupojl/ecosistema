import { $Enums } from '@/generated/prisma';
import { assertValidOrderTransition, InvalidOrderTransitionError, VALID_TRANSITIONS, type OrderStatus } from './order.errors';

const ALL = Object.values($Enums.OrderStatus) as OrderStatus[];

describe('máquina de estados de la orden', () => {
  it('cubre EXACTAMENTE los estados del enum de la base (si se agrega uno, hay que definir sus transiciones)', () => {
    expect(Object.keys(VALID_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });

  it('toda transición apunta a un estado que existe', () => {
    for (const targets of Object.values(VALID_TRANSITIONS)) for (const t of targets) expect(ALL).toContain(t);
  });

  it('una orden recién creada (PENDING_PAYMENT) se puede pagar o cancelar', () => {
    expect(() => assertValidOrderTransition('PENDING_PAYMENT', 'PAID')).not.toThrow();
    expect(() => assertValidOrderTransition('PENDING_PAYMENT', 'CANCELLED')).not.toThrow();
  });

  it('el camino feliz completo es válido', () => {
    const path: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'REFUNDED'];
    for (let i = 0; i < path.length - 1; i++) expect(() => assertValidOrderTransition(path[i]!, path[i + 1]!)).not.toThrow();
  });

  it.each(['CANCELLED', 'REFUNDED'] as const)('%s es terminal: no sale a ningún estado', (terminal) => {
    for (const to of ALL) expect(() => assertValidOrderTransition(terminal, to)).toThrow(InvalidOrderTransitionError);
  });

  it('no se puede saltar etapas ni volver atrás', () => {
    expect(() => assertValidOrderTransition('PENDING_PAYMENT', 'SHIPPED')).toThrow(InvalidOrderTransitionError);
    expect(() => assertValidOrderTransition('SHIPPED', 'PAID')).toThrow(InvalidOrderTransitionError);
    expect(() => assertValidOrderTransition('PAID', 'PAID')).toThrow(InvalidOrderTransitionError);
  });

  it('una orden pagada no se "cancela": se reembolsa (hay dinero de por medio)', () => {
    expect(() => assertValidOrderTransition('PAID', 'CANCELLED')).toThrow(InvalidOrderTransitionError);
    expect(() => assertValidOrderTransition('PAID', 'REFUNDED')).not.toThrow();
  });

  it('el mensaje del error nombra el origen y el destino', () => {
    expect(() => assertValidOrderTransition('DELIVERED', 'PAID')).toThrow('DELIVERED → PAID');
  });
});
