export interface AuditLog {
  id:             string;
  organizationId: string | null;
  userId:         string | null;
  configType:     string;
  configKey:      string | null;
  action:         string;
  previousValue:  string | null;
  newValue:       string | null;
  diff:           Record<string, unknown> | null;
  reason:         string | null;
  ipAddress:      string | null;
  createdAt:      Date;
}

export interface CreateAuditLogInput {
  organizationId?: string;
  userId?:         string;
  configType:      string;
  configKey?:      string;
  action:          string;
  previousValue?:  string;
  newValue?:       string;
  diff?:           Record<string, unknown>;
  reason?:         string;
  ipAddress?:      string;
}

export interface AuditLogFilters {
  configType?: string;
  userId?:     string;
  from?:       Date;
  to?:         Date;
}
