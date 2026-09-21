/**
 * domain/customer.errors.ts — realsass-ecommerce-back
 * Errores de dominio puros para "customers".
 */

export abstract class CustomerDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class CustomerNotFoundError extends CustomerDomainError {
  constructor(identifier: string) {
    super(`Cliente no encontrado: ${identifier}`);
  }
}

export class InvalidEmailError extends CustomerDomainError {
  constructor(email: string) {
    super(`Email inválido: ${email}`);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida que el email tenga formato correcto.
 * Llamar antes de crear/actualizar un customer con email.
 */
export function assertValidEmail(email: string): void {
  if (!EMAIL_RE.test(email)) {
    throw new InvalidEmailError(email);
  }
}
