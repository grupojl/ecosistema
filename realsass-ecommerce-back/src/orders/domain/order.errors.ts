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
// PENDING → CONFIRMED → SHIPPED → DELIVERED
//         → CANCELLED (desde PENDING o CONFIRMED)
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:   ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PAID", "CANCELLED"],
  PAID:      ["SHIPPED"],
  SHIPPED:   ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED:  [],
};

export function assertValidOrderTransition(
  from: OrderStatus,
  to:   OrderStatus,
): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}
