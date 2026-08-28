import type { SecretConfig, CreateSecretInput } from '../domain/secret.entity';

export const SECRETS_REPOSITORY = Symbol('SECRETS_REPOSITORY');

export interface ISecretsRepository {
  findAllByOrg(organizationId: string): Promise<SecretConfig[]>;
  findByIdWithValue(id: string): Promise<(SecretConfig & { valueEncrypted: string }) | null>;
  create(input: CreateSecretInput): Promise<SecretConfig>;
  updateValue(id: string, valueEncrypted: string): Promise<SecretConfig>;
  revoke(id: string): Promise<void>;
}
