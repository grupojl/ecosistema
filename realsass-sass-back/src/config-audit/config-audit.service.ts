import { Injectable, Inject } from '@nestjs/common';
import { AUDIT_REPOSITORY, type IAuditRepository } from './repository/audit.repository.interface';
import type { CreateAuditLogInput, AuditLogFilters } from './domain/audit-log.entity';

@Injectable()
export class ConfigAuditService {
  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly repo: IAuditRepository,
  ) {}

  /** Fire-and-forget — no lanza, no bloquea */
  log(params: CreateAuditLogInput): void {
    this.repo.create(params).catch(err => {
      console.error('[ConfigAuditService] Failed to write audit log', err);
    });
  }

  async getByOrg(
    organizationId: string,
    filters: AuditLogFilters,
    take = 50,
    skip = 0,
  ) {
    return this.repo.findByOrg(organizationId, filters, take, skip);
  }
}
