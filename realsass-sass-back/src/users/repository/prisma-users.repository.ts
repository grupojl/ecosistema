import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma }        from '@prisma/client';
import type { IUsersRepository } from './users.repository.interface';
import type { User, UserProfile, UpsertUserInput } from '../domain/user.entity';

function parsePermissions(raw: unknown): Record<string, boolean> {
  const defaults = {
    canViewListings: true, canCreateListings: false, canEditListings: false,
    canDeleteListings: false, canViewStats: false, canManageLeads: false,
    canManageCollaborators: false,
  };
  if (!raw || typeof raw !== 'object') return defaults;
  return { ...defaults, ...(raw as object) };
}

@Injectable()
export class PrismaUsersRepository implements IUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { firebaseUid } }) as unknown as User | null;
  }

  async upsert(input: UpsertUserInput, tx?: Prisma.TransactionClient): Promise<User> {
    const client = tx ?? this.prisma;
    return client.user.upsert({
      where:  { firebaseUid: input.firebaseUid },
      update: {
        ...(input.email       ? { email:       input.email }       : {}),
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.photoUrl    ? { photoUrl:    input.photoUrl }    : {}),
      },
      create: {
        firebaseUid:   input.firebaseUid,
        email:         input.email,
        displayName:   input.displayName,
        photoUrl:      input.photoUrl,
        referredByCode: input.referredByCode,
        referralCode:  `ref-${input.firebaseUid.slice(0, 8)}`,
      },
    }) as unknown as User;
  }

  async buildProfile(firebaseUid: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: {
        organization:  true,
        collaborations: {
          where:   { status: 'ACTIVE' },
          include: { organization: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    if (!user) return null;

    return {
      user: user as unknown as User,
      organization: user.organization
        ? { id: user.organization.id, name: user.organization.name, slug: user.organization.slug }
        : null,
      collaborations: user.collaborations.map(c => ({
        organizationId: c.organizationId,
        role:           'COLLABORATOR',
        permissions:    parsePermissions(c.permissions),
      })),
    };
  }

  async getOrganizationAccess(firebaseUid: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: {
        organization:  true,
        collaborations: { where: { organizationId, status: 'ACTIVE' } },
      },
    });

    if (!user) return { canAccess: false, reason: 'User not found' };

    // Es owner
    if (user.organization?.id === organizationId) {
      return {
        canAccess:      true,
        userId:         user.id,
        organizationId,
        role:           'OWNER',
        permissions:    {
          canViewListings: true, canCreateListings: true, canEditListings: true,
          canDeleteListings: true, canViewStats: true, canManageLeads: true,
          canManageCollaborators: true,
        },
      };
    }

    // Es colaborador
    const collab = user.collaborations[0];
    if (collab) {
      return {
        canAccess:      true,
        userId:         user.id,
        organizationId,
        role:           'COLLABORATOR',
        permissions:    parsePermissions(collab.permissions),
      };
    }

    return { canAccess: false, reason: 'No access' };
  }
}
