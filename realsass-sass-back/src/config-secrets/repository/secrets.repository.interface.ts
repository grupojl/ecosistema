import type {
  SecretConfig,
  CreateSecretInput,
  RotateSecretInput,
} from '@/domain/secret.entity';

export const SECRETS_REPOSITORY = Symbol('SECRETS_REPOSITORY');

/**
 * Todas las operaciones por id reciben organizationId: un id de otra organización se trata como
 * inexistente (null). Sin esto un dueño podía rotar o revocar secretos ajenos conociendo el id.
 */
export interface ISecretsRepository {
  findAllByOrg(organizationId: string): Promise<SecretConfig[]>;
  findActiveByKey(
    organizationId: string,
    key: string,
  ): Promise<SecretConfig | null>;
  findById(id: string, organizationId: string): Promise<SecretConfig | null>;
  /** Crea, o reactiva una clave revocada con el mismo nombre. */
  create(input: CreateSecretInput): Promise<SecretConfig>;
  updateValue(
    id: string,
    organizationId: string,
    input: RotateSecretInput,
  ): Promise<SecretConfig | null>;
  revoke(id: string, organizationId: string): Promise<boolean>;
}
