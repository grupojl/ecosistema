import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService }        from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type { OrganizationAccessResult } from '@real/auth-server';

const FULL_PERMISSIONS: Record<string, boolean> = {
  canViewListings: true, canCreateListings: true, canEditListings: true,
  canDeleteListings: true, canViewStats: true, canManageLeads: true,
  canManageCollaborators: true,
};

function parsePermissions(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'boolean')
      .map(([k, v]) => [k, v as boolean]),
  );
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orgs:   OrganizationsService,
  ) {}

  async buildProfile(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        organization:  true,
        affiliateData: true,
        collaborations: {
          where:   { status: 'ACTIVE' },
          include: {
            organization: {
              select: {
                id: true, name: true, slug: true, logoUrl: true,
                description: true, website: true, phone: true, address: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const tenants: Array<{
      organizationId: string;
      organization:   unknown;
      role:           'OWNER' | 'COLLABORATOR';
      permissions:    Record<string, boolean>;
    }> = [];

    if (user.isOwner && user.organization) {
      tenants.push({
        organizationId: user.organization.id,
        organization:   user.organization,
        role:           'OWNER',
        permissions:    FULL_PERMISSIONS,
      });
    }

    for (const collab of user.collaborations) {
      tenants.push({
        organizationId: collab.organizationId,
        organization:   collab.organization,
        role:           'COLLABORATOR',
        permissions:    parsePermissions(collab.permissions),
      });
    }

    return {
      id:             user.id,
      firebaseUid:    user.firebaseUid,
      email:          user.email,
      displayName:    user.displayName,
      avatarUrl:      user.avatarUrl,
      isOwner:        user.isOwner,
      isAffiliate:    user.isAffiliate,
      affiliateCode:  user.affiliateCode,
      referredByCode: user.referredByCode,
      createdAt:      user.createdAt,
      updatedAt:      user.updatedAt,
      organization:   user.organization,
      tenants,
      affiliateData:  user.affiliateData
        ? {
            id:            user.affiliateData.id,
            balance:       user.affiliateData.balance.toString(),
            referralCount: user.affiliateData.referralCount,
            createdAt:     user.affiliateData.createdAt,
          }
        : null,
    };
  }

  async getMyProfile(firebaseUid: string) {
    const profile = await this.buildProfile(firebaseUid);
    if (!profile) throw new NotFoundException('Usuario no encontrado. Llama a /auth/sync primero.');
    return profile;
  }

  async getOrganizationAccess(
    firebaseUid:    string,
    organizationId: string,
  ): Promise<OrganizationAccessResult> {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return { canAccess: false, reason: 'Usuario no encontrado' };

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return { canAccess: false, reason: 'Organizacion no encontrada' };

    if (org.userId === user.id) {
      return {
        canAccess: true, userId: user.id, organizationId: org.id,
        role: 'OWNER', permissions: FULL_PERMISSIONS,
      };
    }

    const collab = await this.prisma.collaborator.findFirst({
      where: { userId: user.id, organizationId: org.id, status: 'ACTIVE' },
    });

    if (!collab) return { canAccess: false, reason: 'Sin acceso a esta organizacion' };

    return {
      canAccess: true, userId: user.id, organizationId: org.id,
      role: 'MEMBER', permissions: parsePermissions(collab.permissions),
    };
  }

  async getDashboardAccess(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid }, include: { organization: true, collaborations: true },
    });
    if (!user) return { canAccess: false };
    return {
      canAccess:      user.isOwner || (user.collaborations?.length ?? 0) > 0,
      isOwner:        user.isOwner,
      organizationId: user.organization?.id ?? null,
    };
  }

  async selectRole(firebaseUid: string, dto: { role: 'owner' | 'affiliate' }) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (dto.role === 'owner') {
      await this.prisma.user.update({ where: { id: user.id }, data: { isOwner: true } });
      await this.orgs.createForUser(user.id);
    }

    if (dto.role === 'affiliate') {
      const code = `AF-${user.id.slice(0, 8).toUpperCase()}`;
      await this.prisma.user.update({
        where: { id: user.id }, data: { isAffiliate: true, affiliateCode: code },
      });
      await this.prisma.affiliateData.upsert({
        where: { userId: user.id }, update: {}, create: { userId: user.id },
      });
    }

    return this.buildProfile(firebaseUid);
  }
}
