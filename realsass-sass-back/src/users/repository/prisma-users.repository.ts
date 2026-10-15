import { Injectable }    from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma }   from '@/generated/prisma';
import type { IUsersRepository } from '@/users/repository/users.repository.interface';
import type { OrganizationAccessResult } from '@real/auth-server';
import type { AccessSummary, AccountPatch, CreateAccountInput, User, UserAccount, UserProfile } from '@/domain/user.entity';

type PrismaUser = Prisma.UserGetPayload<Record<string, never>>;
type PrismaUserWithOrg = Prisma.UserGetPayload<{
  include: {
    organizations: true;
    collaborations: { include: { organization: { select: { id: true; name: true; slug: true } } } };
  };
}>;

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  canViewListings: true, canCreateListings: false, canEditListings: false,
  canDeleteListings: false, canViewStats: false, canManageLeads: false,
  canManageCollaborators: false,
};

@Injectable()
export class PrismaUsersRepository implements IUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toUser(row: PrismaUser): User {
    return {
      id:             row.id,
      firebaseUid:    row.firebaseUid,
      email:          row.email,
      displayName:    row.displayName,
      photoUrl:       row.avatarUrl,
      referralCode:   row.affiliateCode,
      referredByCode: row.referredByCode,
      createdAt:      row.createdAt,
      updatedAt:      row.updatedAt,
    };
  }

  private toProfile(row: PrismaUserWithOrg): UserProfile {
    const owned = row.organizations.map(o => ({ id: o.id, name: o.name, slug: o.slug, description: o.description }));
    return {
      user: this.toUser(row),
      organization:  owned[0] ?? null,
      organizations: owned,
      collaborations: row.collaborations.map(c => ({
        organizationId: c.organizationId,
        role:           'MEMBER',
        permissions: { ...DEFAULT_PERMISSIONS, ...(c.permissions as Record<string, boolean>) },
      })),
    };
  }

  private toAccount(row: PrismaUser): UserAccount {
    return {
      id: row.id, firebaseUid: row.firebaseUid, email: row.email, displayName: row.displayName,
      avatarUrl: row.avatarUrl, isOwner: row.isOwner, affiliateCode: row.affiliateCode,
    };
  }

  async findAccountByFirebaseUid(firebaseUid: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findUnique({ where: { firebaseUid } });
    return row ? this.toAccount(row) : null;
  }

  async createAccount(input: CreateAccountInput): Promise<UserAccount> {
    const row = await this.prisma.user.create({
      data: { ...input, isOwner: false, isAffiliate: false },
    });
    return this.toAccount(row);
  }

  async updateAccount(id: string, patch: AccountPatch): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: patch });
  }

  async findAccessSummary(firebaseUid: string): Promise<AccessSummary | null> {
    const row = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: {
        organizations:  { orderBy: { createdAt: 'asc' }, select: { id: true } },
        collaborations: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });
    return row
      ? { email: row.email, organizationIds: row.organizations.map(o => o.id), activeCollaborations: row.collaborations.length }
      : null;
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { firebaseUid } });
    return row ? this.toUser(row) : null;
  }

  async buildProfile(firebaseUid: string): Promise<UserProfile | null> {
    const row = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: {
        organizations:  { orderBy: { createdAt: 'asc' } },
        collaborations: {
          where:   { status: 'ACTIVE' },
          include: { organization: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    return row ? this.toProfile(row) : null;
  }

  async getOrganizationAccess(firebaseUid: string, organizationId: string): Promise<OrganizationAccessResult> {
    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: {
        organizations:  { where: { id: organizationId }, select: { id: true } },
        collaborations: { where: { organizationId, status: 'ACTIVE' } },
      },
    });

    if (!user) return { canAccess: false, reason: 'User not found' };

    // D4: el acceso se valida contra la base en cada request, no contra la cookie.
    if (user.organizations.length > 0) {
      return {
        canAccess: true, userId: user.id, organizationId,
        role: 'OWNER' as import('@real/auth-server').TenantRole,
        permissions: Object.fromEntries(Object.keys(DEFAULT_PERMISSIONS).map(k => [k, true])),
      };
    }

    const collab = user.collaborations[0];
    if (collab) {
      return {
        canAccess: true, userId: user.id, organizationId,
        role: 'MEMBER' as import('@real/auth-server').TenantRole,
        permissions: { ...DEFAULT_PERMISSIONS, ...(collab.permissions as Record<string, boolean>) },
      };
    }

    return { canAccess: false, reason: 'No access' };
  }
}
