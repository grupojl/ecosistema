import type { AuditLog, CreateAuditLogInput, AuditLogFilters } from '../domain/audit-log.entity';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface IAuditRepository {
  create(input: CreateAuditLogInput): Promise<void>;
  findByOrg(organizationId: string, filters: AuditLogFilters, take: number, skip: number): Promise<AuditLog[]>;
}
