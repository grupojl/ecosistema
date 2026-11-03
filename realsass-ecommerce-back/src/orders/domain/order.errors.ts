/**
 * domain/order.errors.ts — realsass-ecommerce-back
 * Errores de dominio puros para el bounded context "orders".
 */

export abstract class OrderDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class OrderNotFoundError extends OrderDomainError {
  constructor(orderId: string) {
    super(`Orden no encontrada: ${orderId}`);
  }
}

export class InvalidOrderTransitionError extends OrderDomainError {
  constructor(from: string, to: string) {
    super(`Transición de estado inválida: ${from} → ${to}`);
  }
}

export class OrderAlreadyPaidError extends OrderDomainError {
  constructor(orderId: string) {
    super(`La orden ${orderId} ya fue pagada`);
  }
}

// ── Estado de orden — máquina de estados ─────────────────────────────────────
// Los estados son EXACTAMENTE los del enum OrderStatus de la base (prisma/schema.prisma). Antes el dominio usaba otros
// nombres (PENDING, CONFIRMED) y una orden recién creada (PENDING_PAYMENT) no tenía ninguna transición válida.
// Un test exige que cada valor del enum tenga su entrada aquí.
//
//   PENDING_PAYMENT → PAID → FULFILLING → SHIPPED → DELIVERED
//   PENDING_PAYMENT → CANCELLED                      (sin pago no hay nada que devolver)
//   PAID / FULFILLING / SHIPPED / DELIVERED → REFUNDED
//   CANCELLED y REFUNDED son terminales.
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'FULFILLING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['FULFILLING', 'REFUNDED'],
  FULFILLING: ['SHIPPED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export function assertValidOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}
