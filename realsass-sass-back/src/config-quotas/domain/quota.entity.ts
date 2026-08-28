export interface QuotaConfig {
  id:             string;
  organizationId: string;
  resource:       string;
  limit:          number | null;
  currentUsage:   number;
  createdAt:      Date;
  updatedAt:      Date;
}
