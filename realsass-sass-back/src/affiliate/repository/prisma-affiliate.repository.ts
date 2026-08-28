import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { IAffiliateRepository } from './affiliate.repository.interface';
import type { AffiliateProfile, AffiliateReferral } from '../domain/affiliate.entity';

@Injectable()
export class PrismaAffiliateRepository implements IAffiliateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProfileByFirebaseUid(firebaseUid: string): Promise<AffiliateProfile | null> {
    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: { affiliateData: true },
    });
    if (!user?.affiliateData) return null;
    return {
      id:            user.affiliateData.id,
      userId:        user.id,
      referralCode:  user.referralCode ?? '',
      balance:       Number(user.affiliateData.balance),
      referralCount: user.affiliateData.referralCount,
      createdAt:     user.affiliateData.createdAt,
      updatedAt:     user.affiliateData.updatedAt,
    };
  }

  async findReferralsByCode(referralCode: string): Promise<AffiliateReferral[]> {
    const referrals = await this.prisma.user.findMany({
      where:  { referredByCode: referralCode },
      select: { id: true, firebaseUid: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return referrals.map(r => ({
      id:          r.id,
      firebaseUid: r.firebaseUid,
      email:       r.email,
      createdAt:   r.createdAt,
    }));
  }

  async findByCode(referralCode: string): Promise<AffiliateProfile | null> {
    const user = await this.prisma.user.findFirst({
      where:   { referralCode },
      include: { affiliateData: true },
    });
    if (!user?.affiliateData) return null;
    return {
      id:            user.affiliateData.id,
      userId:        user.id,
      referralCode:  user.referralCode ?? '',
      balance:       Number(user.affiliateData.balance),
      referralCount: user.affiliateData.referralCount,
      createdAt:     user.affiliateData.createdAt,
      updatedAt:     user.affiliateData.updatedAt,
    };
  }

  async incrementReferralCount(userId: string): Promise<void> {
    await this.prisma.affiliateData.update({
      where: { userId },
      data:  { referralCount: { increment: 1 } },
    });
  }

  async ensureProfile(userId: string, referralCode: string): Promise<AffiliateProfile> {
    const data = await this.prisma.affiliateData.upsert({
      where:  { userId },
      update: {},
      create: { userId, balance: 0, referralCount: 0 },
    });
    return {
      id:            data.id,
      userId,
      referralCode,
      balance:       Number(data.balance),
      referralCount: data.referralCount,
      createdAt:     data.createdAt,
      updatedAt:     data.updatedAt,
    };
  }
}
