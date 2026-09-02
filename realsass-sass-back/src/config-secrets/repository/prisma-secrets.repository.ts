import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { ISecretsRepository } from './secrets.repository.interface';
import type { SecretConfig, CreateSecretInput } from '../domain/secret.entity';

type PrismaSecret = Prisma.SecretConfigGetPayload<Record<string, never>>;

const SELECT_PUBLIC = {
  id: true, organizationId: true, key: true,
  description: true, isActive: true, createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class PrismaSecretsRepository implements ISecretsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: Omit<PrismaSecret, 'valueEncrypted'>): SecretConfig {
    return {
      id:             row.id,
      organizationId: row.organizationId,
      key:            row.key,
      description:    row.description,
      isActive:       row.isActive,
      createdAt:      row.createdAt,
      updatedAt:      row.updatedAt,
    };
  }

  async findAllByOrg(organizationId: string): Promise<SecretConfig[]> {
    const rows = await this.prisma.secretConfig.findMany({
      where: { organizationId, isActive: true },
      select: SELECT_PUBLIC,
    });
    return rows.map(r => this.toEntity(r));
  }

  async findByIdWithValue(id: string): Promise<(SecretConfig & { valueEncrypted: string }) | null> {
    const row = await this.prisma.secretConfig.findUnique({ where: { id } });
    if (!row) return null;
    return { ...this.toEntity(row), valueEncrypted: row.valueEncrypted };
  }

  async create(input: CreateSecretInput): Promise<SecretConfig> {
    const row = await this.prisma.secretConfig.create({
      data: {
        organizationId: input.organizationId,
        key:            input.key,
        valueEncrypted: input.valueEncrypted,
        description:    input.description,
        isActive:       true,
      },
      select: SELECT_PUBLIC,
    });
    return this.toEntity(row);
  }

  async updateValue(id: string, valueEncrypted: string): Promise<SecretConfig> {
    const row = await this.prisma.secretConfig.update({
      where: { id }, data: { valueEncrypted }, select: SELECT_PUBLIC,
    });
    return this.toEntity(row);
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.secretConfig.update({ where: { id }, data: { isActive: false } });
  }
}
