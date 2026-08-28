export interface SecretConfig {
  id:             string;
  organizationId: string;
  key:            string;
  description:    string | null;
  isActive:       boolean;
  createdAt:      Date;
  updatedAt:      Date;
  /** valueEncrypted nunca se expone al cliente */
}

export interface CreateSecretInput {
  organizationId:  string;
  key:             string;
  valueEncrypted:  string;
  description?:    string;
}
