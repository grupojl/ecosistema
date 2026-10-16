export const CUSTOMERS_REPOSITORY = Symbol('CUSTOMERS_REPOSITORY');

export interface CustomerRecord {
  id:             string;
  organizationId: string;
  email:          string;
  displayName:    string | null;
  phone:          string | null;
  isGuest:        boolean;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface ICustomersRepository {
  /** Un cliente por (organización, email). `created` indica si se acaba de crear. */
  upsertByEmail(
    organizationId: string,
    email:          string,
    patch:          { displayName?: string; phone?: string },
  ): Promise<{ customer: CustomerRecord; created: boolean }>;
  findById(organizationId: string, customerId: string): Promise<CustomerRecord | null>;
  findBySessionId(organizationId: string, sessionId: string): Promise<CustomerRecord | null>;
  update(
    organizationId: string,
    customerId:     string,
    patch: { email?: string; displayName?: string; phone?: string },
  ): Promise<CustomerRecord>;
  listByOrg(
    organizationId: string,
    filters?: { search?: string; page?: number; limit?: number },
  ): Promise<{ items: CustomerRecord[]; total: number }>;
}
