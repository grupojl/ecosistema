import type { QuotaConfig } from '../domain/quota.entity';

export const QUOTAS_REPOSITORY = Symbol('QUOTAS_REPOSITORY');

export interface IQuotasRepository {
  findAllByOrg(organizationId: string): Promise<QuotaConfig[]>;
  findByResource(organizationId: string, resource: string): Promise<QuotaConfig | null>;
  increment(organizationId: string, resource: string, delta: number): Promise<void>;
  updateLimit(organizationId: string, resource: string, limit: number): Promise<QuotaConfig>;
}
