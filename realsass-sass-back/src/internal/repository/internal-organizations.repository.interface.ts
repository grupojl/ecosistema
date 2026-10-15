export const INTERNAL_ORGANIZATIONS_REPOSITORY = Symbol('INTERNAL_ORGANIZATIONS_REPOSITORY');

/** Fila de organización tal como la necesita la superficie interna (superadmin). Sin datos del dueño. */
export interface InternalOrgRow {
  id:          string;
  ecosystemId: string | null;
  name:        string | null;
  slug:        string | null;
  status:      string;
  storeStatus: string;
  plan:        string | null;
  createdAt:   Date;
  suspendedAt: Date | null;
}

export interface InternalOrgFilters {
  ecosystemId?: string;
  status?:      'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  storeStatus?: 'ACTIVE' | 'PAUSED';
  /** Busca (sin distinguir mayúsculas) en nombre y slug. */
  search?:      string;
}

/**
 * Persistencia de la superficie interna de organizaciones. A diferencia del resto, es CROSS-TENANT por
 * diseño (el superadmin ve todas las organizaciones): por eso vive aparte y solo la usa InternalApiKeyGuard.
 */
export interface IInternalOrganizationsRepository {
  list(filters: InternalOrgFilters, page: number, limit: number): Promise<{ rows: InternalOrgRow[]; total: number }>;
  findById(id: string): Promise<InternalOrgRow | null>;
  suspend(id: string, at: Date): Promise<InternalOrgRow>;
  unsuspend(id: string): Promise<InternalOrgRow>;
  setStoreStatus(id: string, storeStatus: 'ACTIVE' | 'PAUSED'): Promise<InternalOrgRow>;
}
