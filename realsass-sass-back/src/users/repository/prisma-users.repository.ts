import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { IUsersRepository } from './users.repository.interface';
import type { User, UserProfile, UpsertUserInput } from '../domain/user.entity';

type PrismaUser = Prisma.UserGetPayload<Record<string, never>>;
type PrismaUserWithOrg = Prisma.UserGetPayload<{
  include: {
    organization: true;
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
    return {
      user: this.toUser(row),
      organization: row.organization
        ? { id: row.organization.id, name: row.organization.name, slug: row.organization.slug }
        : null,
      collaborations: row.collaborations.map(c => ({
        organizationId: c.organizationId,
        role:           'COLLABORATOR',
        // @real/jsonb-cast
        permissions: { ...DEFAULT_PERMISSIONS, ...(c.permissions as Record<string, boolean>) },
      })),
    };
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { firebaseUid } });
    return row ? this.toUser(row) : null;
  }

  async upsert(input: UpsertUserInput, tx?: Prisma.TransactionClient): Promise<User> {
    const client = tx ?? this.prisma;
    const row    = await client.user.upsert({
      where:  { firebaseUid: input.firebaseUid },
      update: {
        ...(input.email       ? { email:       input.email }       : {}),
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.photoUrl    ? { avatarUrl:   input.photoUrl }    : {}),
      },
      create: {
        firebaseUid:   input.firebaseUid,
        email:         input.email ?? '',
        displayName:   input.displayName,
        avatarUrl:     input.photoUrl,
        referredByCode: input.referredByCode,
        affiliateCode:  `ref-${input.firebaseUid.slice(0, 8)}`,
      },
    });
    return this.toUser(row);
  }

  async buildProfile(firebaseUid: string): Promise<UserProfile | null> {
    const row = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: {
        organization:   true,
        collaborations: {
          where:   { status: 'ACTIVE' },
          include: { organization: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    return row ? this.toProfile(row) : null;
  }

  async getOrganizationAccess(firebaseUid: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: {
        organization:   true,
        collaborations: { where: { organizationId, status: 'ACTIVE' } },
      },
    });

    if (!user) return { canAccess: false, reason: 'User not found' };

    if (user.organization?.id === organizationId) {
      return {
        canAccess: true, userId: user.id, organizationId,
        role: 'OWNER',
        permissions: Object.fromEntries(Object.keys(DEFAULT_PERMISSIONS).map(k => [k, true])),
      };
    }

    const collab = user.collaborations[0];
    if (collab) {
      return {
        canAccess: true, userId: user.id, organizationId,
        role: 'COLLABORATOR',
        // @real/jsonb-cast
        permissions: { ...DEFAULT_PERMISSIONS, ...(collab.permissions as Record<string, boolean>) },
      };
    }

    return { canAccess: false, reason: 'No access' };
  }
}
