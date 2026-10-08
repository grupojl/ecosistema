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
  identifyBySession(organizationId: string, sessionId: string): Promise<CustomerRecord>;
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
