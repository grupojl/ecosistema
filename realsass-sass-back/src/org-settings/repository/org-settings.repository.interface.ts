export const ORG_SETTINGS_REPOSITORY = Symbol('ORG_SETTINGS_REPOSITORY');

export interface OrgSettingsRecord {
  /** JSON tal como está guardado: el servicio lo valida con Zod antes de usarlo. */
  general: unknown;
  storefront: unknown;
  updatedAt: Date;
}

export interface IOrgSettingsRepository {
  findByOrg(organizationId: string): Promise<OrgSettingsRecord | null>;
  saveGeneral(
    organizationId: string,
    general: Record<string, unknown>,
    userId: string,
  ): Promise<void>;
  saveStorefront(
    organizationId: string,
    storefront: Record<string, unknown>,
    userId: string,
  ): Promise<void>;
}
