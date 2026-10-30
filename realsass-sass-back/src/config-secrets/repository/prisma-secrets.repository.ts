import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma } from '@/generated/prisma';
import type { ISecretsRepository } from '@/config-secrets/repository/secrets.repository.interface';
import type {
  SecretConfig,
  CreateSecretInput,
  RotateSecretInput,
} from '@/domain/secret.entity';

// Columnas que sí pueden salir de la base: jamás valueEncrypted / valueIv / valueTag.
const SELECT_PUBLIC = {
  id: true,
  organizationId: true,
  key: true,
  description: true,
  isActive: true,
  keyPrefix: true,
  systemTarget: true,
  rotatedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicRow = Prisma.SecretConfigGetPayload<{
  select: typeof SELECT_PUBLIC;
}>;

@Injectable()
export class PrismaSecretsRepository implements ISecretsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PublicRow): SecretConfig {
    return {
      id: row.id,
      organizationId: row.organizationId,
      key: row.key,
      description: row.description,
      isActive: row.isActive,
      hint: row.keyPrefix,
      systemTarget: row.systemTarget,
      rotatedAt: row.rotatedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findAllByOrg(organizationId: string): Promise<SecretConfig[]> {
    const rows = await this.prisma.secretConfig.findMany({
      where: { organizationId, isActive: true },
      select: SELECT_PUBLIC,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findActiveByKey(
    organizationId: string,
    key: string,
  ): Promise<SecretConfig | null> {
    const row = await this.prisma.secretConfig.findFirst({
      where: { organizationId, key, isActive: true },
      select: SELECT_PUBLIC,
    });
    return row ? this.toEntity(row) : null;
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<SecretConfig | null> {
    const row = await this.prisma.secretConfig.findFirst({
      where: { id, organizationId },
      select: SELECT_PUBLIC,
    });
    return row ? this.toEntity(row) : null;
  }

  async create(input: CreateSecretInput): Promise<SecretConfig> {
    const data = {
      valueEncrypted: input.valueEncrypted,
      valueIv: input.valueIv,
      valueTag: input.valueTag,
      keyPrefix: input.hint,
      description: input.description ?? null,
      systemTarget: input.systemTarget ?? 'all',
      expiresAt: input.expiresAt ?? null,
      isActive: true,
    };
    // (organizationId, key) es único: si había una clave revocada con ese nombre, se reactiva con el valor nuevo.
    const row = await this.prisma.secretConfig.upsert({
      where: {
        organizationId_key: {
          organizationId: input.organizationId,
          key: input.key,
        },
      },
      create: { organizationId: input.organizationId, key: input.key, ...data },
      update: { ...data, rotatedAt: null },
      select: SELECT_PUBLIC,
    });
    return this.toEntity(row);
  }

  async updateValue(
    id: string,
    organizationId: string,
    input: RotateSecretInput,
  ): Promise<SecretConfig | null> {
    const res = await this.prisma.secretConfig.updateMany({
      where: { id, organizationId, isActive: true },
      data: {
        valueEncrypted: input.valueEncrypted,
        valueIv: input.valueIv,
        valueTag: input.valueTag,
        keyPrefix: input.hint,
        rotatedAt: new Date(),
      },
    });
    return res.count === 0 ? null : this.findById(id, organizationId);
  }

  async revoke(id: string, organizationId: string): Promise<boolean> {
    const res = await this.prisma.secretConfig.updateMany({
      where: { id, organizationId, isActive: true },
      data: { isActive: false },
    });
    return res.count > 0;
  }
}
