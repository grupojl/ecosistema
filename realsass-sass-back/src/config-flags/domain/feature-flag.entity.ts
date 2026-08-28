export interface FeatureFlag {
  id:                 string;
  organizationId:     string | null;
  key:                string;
  enabled:            boolean;
  description:        string | null;
  rolloutPercentage:  number;
  conditions:         Record<string, unknown>;
  createdAt:          Date;
  updatedAt:          Date;
}

export interface UpdateFeatureFlagInput {
  enabled?:           boolean;
  description?:       string;
  rolloutPercentage?: number;
  conditions?:        Record<string, unknown>;
}
