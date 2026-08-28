import type { FeatureFlag, UpdateFeatureFlagInput } from '../domain/feature-flag.entity';

export const FEATURE_FLAGS_REPOSITORY = Symbol('FEATURE_FLAGS_REPOSITORY');

export interface IFeatureFlagsRepository {
  findAllByOrg(organizationId: string): Promise<FeatureFlag[]>;
  findById(id: string): Promise<FeatureFlag | null>;
  update(id: string, input: UpdateFeatureFlagInput): Promise<FeatureFlag>;
}
