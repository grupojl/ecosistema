import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ISecretsRepository } from './secrets.repository.interface';
import type { SecretConfig, CreateSecretInput } from '../domain/secret.entity';

@Injectable()
export class PrismaSecretsRepository implements ISecretsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOrg(organizationId: string): Promise<SecretConfig[]> {
    return this.prisma.secretConfig.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, organizationId: true, key: true, description: true, isActive: true, createdAt: true, updatedAt: true },
    }) as unknown as SecretConfig[];
  }

  async findByIdWithValue(id: string) {
    return this.prisma.secretConfig.findUnique({ where: { id } }) as unknown as (SecretConfig & { valueEncrypted: string }) | null;
  }

  async create(input: CreateSecretInput): Promise<SecretConfig> {
    return this.prisma.secretConfig.create({
      data: { organizationId: input.organizationId, key: input.key, valueEncrypted: input.valueEncrypted, description: input.description, isActive: true },
      select: { id: true, organizationId: true, key: true, description: true, isActive: true, createdAt: true, updatedAt: true },
    }) as unknown as SecretConfig;
  }

  async updateValue(id: string, valueEncrypted: string): Promise<SecretConfig> {
    return this.prisma.secretConfig.update({
      where: { id }, data: { valueEncrypted },
      select: { id: true, organizationId: true, key: true, description: true, isActive: true, createdAt: true, updatedAt: true },
    }) as unknown as SecretConfig;
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.secretConfig.update({ where: { id }, data: { isActive: false } });
  }
}
