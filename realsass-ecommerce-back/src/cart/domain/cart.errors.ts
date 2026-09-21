/**
 * domain/cart.errors.ts — realsass-ecommerce-back
 * Errores de dominio puros. No extienden HttpException.
 * La capa Application (cart.service.ts) los traduce a errores HTTP/tRPC.
 */

export abstract class CartDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class CartNotFoundError extends CartDomainError {
  constructor(cartId: string) {
    super(`Carrito no encontrado: ${cartId}`);
  }
}

export class CartItemNotFoundError extends CartDomainError {
  constructor(variantId: string) {
    super(`Variante no encontrada en el carrito: ${variantId}`);
  }
}

export class InsufficientStockForCartError extends CartDomainError {
  constructor(variantId: string, requested: number, available: number) {
    super(`Stock insuficiente para variante ${variantId}: solicitado ${requested}, disponible ${available}`);
  }
}

export class InvalidQuantityError extends CartDomainError {
  constructor(quantity: number) {
    super(`Cantidad inválida: ${quantity}. Debe ser mayor a 0.`);
  }
}

/**
 * Invariante: la cantidad de un ítem no puede ser negativa ni cero.
 */
export function assertValidQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new InvalidQuantityError(quantity);
  }
}
