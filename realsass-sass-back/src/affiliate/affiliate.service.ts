import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import {
  AFFILIATE_REPOSITORY,
  type IAffiliateRepository,
} from '@/affiliate/repository/affiliate.repository.interface';

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(
    @Inject(AFFILIATE_REPOSITORY)
    private readonly repo: IAffiliateRepository,
  ) {}

  async getMyProfile(firebaseUid: string) {
    const profile = await this.repo.findProfileByFirebaseUid(firebaseUid);
    if (!profile) throw new NotFoundException('Affiliate profile not found');
    return profile;
  }

  async getMyReferrals(firebaseUid: string) {
    const profile = await this.repo.findProfileByFirebaseUid(firebaseUid);
    if (!profile) throw new NotFoundException('Affiliate profile not found');
    return this.repo.findReferralsByCode(profile.referralCode);
  }

  /** D2: todo usuario con código de afiliado tiene su perfil (saldo y contador). Idempotente. */
  async ensureProfile(userId: string, referralCode: string) {
    return this.repo.ensureProfile(userId, referralCode);
  }

  /**
   * Registra un referido cuando un nuevo usuario se sincroniza con un código.
   * Llamado desde AuthService.syncUser().
   */
  async registerReferral(
    affiliateCode: string,
    newUserId: string,
  ): Promise<void> {
    const affiliate = await this.repo.findByCode(affiliateCode);
    if (!affiliate) {
      this.logger.warn(`Affiliate code not found: ${affiliateCode}`);
      return;
    }
    if (affiliate.userId === newUserId) return; // no auto-referidos
    try {
      await this.repo.incrementReferralCount(affiliate.userId);
      // El referido queda asentado en el usuario nuevo: sin esto `affiliates.myReferrals` salía siempre vacío.
      await this.repo.setReferredBy(newUserId, affiliateCode);
      this.logger.log(
        `Referral registered: code=${affiliateCode} newUser=${newUserId}`,
      );
    } catch (err) {
      this.logger.error('Failed to register referral', err);
    }
  }
}
