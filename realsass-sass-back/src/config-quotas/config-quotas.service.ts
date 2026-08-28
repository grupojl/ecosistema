import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ConfigCacheService }   from '../config-cache/config-cache.service';
import { ConfigAuditService }   from '../config-audit/config-audit.service';
import { QuotaExceededException } from '../common/exceptions/quota-exceeded.exception';
import { EventEmitter2 }        from '@nestjs/event-emitter';
import { QUOTAS_REPOSITORY, type IQuotasRepository } from './repository/quotas.repository.interface';

@Injectable()
export class ConfigQuotasService {
  constructor(
    @Inject(QUOTAS_REPOSITORY)
    private readonly repo:   IQuotasRepository,
    private readonly cache:  ConfigCacheService,
    private readonly audit:  ConfigAuditService,
    private readonly events: EventEmitter2,
  ) {}

  async getForOrg(organizationId: string) {
    return this.repo.findAllByOrg(organizationId);
  }

  async check(organizationId: string, resource: string) {
    const quota = await this.repo.findByResource(organizationId, resource);
    if (!quota) return; // sin quota configurada = sin límite
    if (quota.limit !== null && quota.currentUsage >= quota.limit) {
      throw new QuotaExceededException(resource, quota.limit);
    }
  }

  async increment(organizationId: string, resource: string, delta = 1) {
    await this.check(organizationId, resource);
    await this.repo.increment(organizationId, resource, delta);
  }

  async updateLimit(organizationId: string, userId: string, resource: string, limit: number) {
    const previous = await this.repo.findByResource(organizationId, resource);
    const updated  = await this.repo.updateLimit(organizationId, resource, limit);

    this.audit.log({
      organizationId, userId,
      configType: 'quota', configKey: resource,
      action: 'update_limit',
      previousValue: previous ? String(previous.limit) : 'none',
      newValue: String(limit),
    });

    return updated;
  }
}
