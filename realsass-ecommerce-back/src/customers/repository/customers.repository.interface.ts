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

export interface CustomerContactPatch {
  email?:       string;
  displayName?: string;
  phone?:       string;
}

export interface ICustomersRepository {
  /** Crea un cliente invitado NUEVO (email placeholder único). Nunca reutiliza uno existente. */
  createGuest(organizationId: string): Promise<CustomerRecord>;
  findById(organizationId: string, customerId: string): Promise<CustomerRecord | null>;
  /**
   * Guarda datos de contacto del cliente. El email solo se asigna si NINGÚN otro cliente de la
   * organización lo tiene: un email ya registrado se ignora en silencio (no se enlaza la cuenta ajena
   * ni se revela que existe).
   */
  attachContact(organizationId: string, customerId: string, patch: CustomerContactPatch): Promise<CustomerRecord>;
  update(
    organizationId: string,
    customerId:     string,
    patch: CustomerContactPatch,
  ): Promise<CustomerRecord>;
  listByOrg(
    organizationId: string,
    filters?: { search?: string; page?: number; limit?: number },
  ): Promise<{ items: CustomerRecord[]; total: number }>;
  /**
   * GDPR/LGPD: reemplaza los datos personales por valores anónimos y borra las direcciones. La fila se conserva
   * (las órdenes pasadas la referencian). Devuelve false si el cliente no existe en la organización.
   */
  anonymize(organizationId: string, customerId: string): Promise<boolean>;
}
