import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { IAffiliateRepository } from './affiliate.repository.interface';
import type { AffiliateProfile, AffiliateReferral } from '../domain/affiliate.entity';

type PrismaAffiliateData = Prisma.AffiliateDataGetPayload<Record<string, never>>;
type PrismaUser          = Prisma.UserGetPayload<Record<string, never>>;

@Injectable()
export class PrismaAffiliateRepository implements IAffiliateRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toProfile(data: PrismaAffiliateData, user: PrismaUser): AffiliateProfile {
    return {
      id:            data.id,
      userId:        user.id,
      referralCode:  user.affiliateCode ?? '',
      balance:       Number(data.balance),
      referralCount: data.referralCount,
      createdAt:     data.createdAt,
      updatedAt:     data.updatedAt,
    };
  }

  private toReferral(user: PrismaUser): AffiliateReferral {
    return {
      id:          user.id,
      firebaseUid: user.firebaseUid,
      email:       user.email,
      createdAt:   user.createdAt,
    };
  }

  async findProfileByFirebaseUid(firebaseUid: string): Promise<AffiliateProfile | null> {
    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: { affiliateData: true },
    });
    if (!user?.affiliateData) return null;
    return this.toProfile(user.affiliateData, user);
  }

  async findReferralsByCode(referralCode: string): Promise<AffiliateReferral[]> {
    const users = await this.prisma.user.findMany({
      where:   { referredByCode: referralCode },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(u => this.toReferral(u));
  }

  async findByCode(referralCode: string): Promise<AffiliateProfile | null> {
    const user = await this.prisma.user.findFirst({
      where:   { affiliateCode: referralCode },
      include: { affiliateData: true },
    });
    if (!user?.affiliateData) return null;
    return this.toProfile(user.affiliateData, user);
  }

  async incrementReferralCount(userId: string): Promise<void> {
    await this.prisma.affiliateData.update({
      where: { userId },
      data:  { referralCount: { increment: 1 } },
    });
  }

  async ensureProfile(userId: string, referralCode: string): Promise<AffiliateProfile> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const data = await this.prisma.affiliateData.upsert({
      where:  { userId },
      update: {},
      create: { userId, balance: 0, referralCount: 0 },
    });
    return this.toProfile(data, user);
  }
}
