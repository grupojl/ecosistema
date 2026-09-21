/**
 * repository/customers.repository.interface.ts — realsass-ecommerce-back
 *
 * Puerto (interface) para "customers".
 * Token: CUSTOMERS_REPOSITORY
 */

export const CUSTOMERS_REPOSITORY = Symbol("CUSTOMERS_REPOSITORY");

export interface CustomerRecord {
  id:             string;
  organizationId: string;
  sessionId:      string;
  email:          string | null;
  name:           string | null;
  phone:          string | null;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface ICustomersRepository {
  /**
   * Busca o crea un customer por sessionId dentro de la organización.
   * Usado por el storefront para identificar al visitante.
   */
  identifyBySession(
    organizationId: string,
    sessionId:      string,
  ): Promise<CustomerRecord>;

  findById(organizationId: string, customerId: string): Promise<CustomerRecord | null>;

  findBySessionId(organizationId: string, sessionId: string): Promise<CustomerRecord | null>;

  update(
    organizationId: string,
    customerId:     string,
    patch: {
      email?: string;
      name?:  string;
      phone?: string;
    },
  ): Promise<CustomerRecord>;

  listByOrg(
    organizationId: string,
    filters?: { search?: string; page?: number; limit?: number },
  ): Promise<{ items: CustomerRecord[]; total: number }>;
}
