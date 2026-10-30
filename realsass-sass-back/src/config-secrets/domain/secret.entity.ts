export interface SecretConfig {
  id: string;
  organizationId: string;
  key: string;
  description: string | null;
  isActive: boolean;
  /** Pista para reconocer la clave sin exponerla: sus últimos 4 caracteres. */
  hint: string;
  systemTarget: string;
  rotatedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** valueEncrypted / valueIv / valueTag nunca se exponen al cliente */
}

export interface CreateSecretInput {
  organizationId: string;
  key: string;
  valueEncrypted: string;
  valueIv: string;
  valueTag: string;
  hint: string;
  description?: string;
  systemTarget?: string;
  expiresAt?: Date;
}

export interface RotateSecretInput {
  valueEncrypted: string;
  valueIv: string;
  valueTag: string;
  hint: string;
}
