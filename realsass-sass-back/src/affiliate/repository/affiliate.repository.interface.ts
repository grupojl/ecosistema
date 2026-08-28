import type { AffiliateProfile, AffiliateReferral } from '../domain/affiliate.entity';

export const AFFILIATE_REPOSITORY = Symbol('AFFILIATE_REPOSITORY');

export interface IAffiliateRepository {
  findProfileByFirebaseUid(firebaseUid: string): Promise<AffiliateProfile | null>;
  findReferralsByCode(referralCode: string): Promise<AffiliateReferral[]>;
  findByCode(referralCode: string): Promise<AffiliateProfile | null>;
  incrementReferralCount(userId: string): Promise<void>;
  ensureProfile(userId: string, referralCode: string): Promise<AffiliateProfile>;
}
