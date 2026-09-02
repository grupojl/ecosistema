/**
 * customer.types.ts — realsass-ecommerce-back
 *
 * Tipos de retorno de CustomersService — sin `as any`.
 */

export interface CustomerOutput {
  id:             string;
  organizationId: string;
  email:          string;
  displayName:    string | null;
  phone:          string | null;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface IdentifyCustomerOutput {
  customerId:      string;
  isNew:           boolean;
}
