import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SelectRoleDto, UserRole } from './dto/select-role.dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { v4 as uuidv4 } from 'uuid';
import type { OrganizationAccessResult } from './types/organization-access.types';

// ── Helper permisos JSONB (users.service) ─────────────────────────────────────
function parseCollabPermissions(raw) {
  const DEFAULT = { canViewListings: true, canCreateListings: true, canEditListings: true,
    canDeleteListings: false, canViewStats: true, canManageLeads: false, canManageCollaborators: false };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT };
  const p = raw;
  return {
    canViewListings:        typeof p.canViewListings        === 'boolean' ? p.canViewListings        : DEFAULT.canViewListings,
    canCreateListings:      typeof p.canCreateListings      === 'boolean' ? p.canCreateListings      : DEFAULT.canCreateListings,
    canEditListings:        typeof p.canEditListings        === 'boolean' ? p.canEditListings        : DEFAULT.canEditListings,
    canDeleteListings:      typeof p.canDeleteListings      === 'boolean' ? p.canDeleteListings      : DEFAULT.canDeleteListings,
    canViewStats:           typeof p.canViewStats           === 'boolean' ? p.canViewStats           : DEFAULT.canViewStats,
    canManageLeads:         typeof p.canManageLeads         === 'boolean' ? p.canManageLeads         : DEFAULT.canManageLeads,
    canManageCollaborators: typeof p.canManageCollaborators === 'boolean' ? p.canManageCollaborators : DEFAULT.canManageCollaborators,
  };
}
// ─────────────────────────────────────────────────────────────────────────────


@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /**
   * Construye el perfil completo del usuario — shape canónico para el front.
   */
  async buildProfile(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        organization: true,
        affiliateData: true,
        collaborations: {
          where: { status: 'ACTIVE' },
          include: {
            organization: {
              select: {
                id:          true,
                name:        true,
                logoUrl:     true,
                description: true,
                website:     true,
                phone:       true,
                address:     true,
                userId:      true,
                createdAt:   true,
                updatedAt:   true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    type Tenant = {
      organizationId: string
      organization:   any
      role:           'OWNER' | 'COLLABORATOR'
      permissions: {
        canViewListings:        boolean
        canCreateListings:      boolean
        canEditListings:        boolean
        canDeleteListings:      boolean
        canViewStats:           boolean
        canManageLeads:         boolean
        canManageCollaborators: boolean
      }
    }
    const tenants: Tenant[] = [];

    if (user.isOwner && user.organization) {
      tenants.push({
        organizationId: user.organization.id,
        organization:   user.organization,
        role:           'OWNER' as const,
        permissions: {
          canViewListings:        true,
          canCreateListings:      true,
          canEditListings:        true,
          canDeleteListings:      true,
          canViewStats:           true,
          canManageLeads:         true,
          canManageCollaborators: true,
        },
      });
    }

    for (const collab of user.collaborations) {
      tenants.push({
        organizationId: collab.organizationId,
        organization:   collab.organization,
        role:           'COLLABORATOR' as const,
        permissions: {
          canViewListings:        parseCollabPermissions(collab.permissions).canViewListings,
          canCreateListings:      parseCollabPermissions(collab.permissions).canCreateListings,
          canEditListings:        parseCollabPermissions(collab.permissions).canEditListings,
          canDeleteListings:      parseCollabPermissions(collab.permissions).canDeleteListings,
          canViewStats:           parseCollabPermissions(collab.permissions).canViewStats,
          canManageLeads:         parseCollabPermissions(collab.permissions).canManageLeads,
          canManageCollaborators: parseCollabPermissions(collab.permissions).canManageCollaborators,
        },
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
    if (!profile) throw new NotFoundException('Usuario no encontrado. Llamá a /auth/sync primero.');
    return profile;
  }

  async selectRole(firebaseUid: string, dto: SelectRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { organization: true, affiliateData: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado. Llamá a /auth/sync primero.');
    }

    if (dto.role === UserRole.OWNER) {
      if (user.isOwner) throw new BadRequestException('El usuario ya es Owner');

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { isOwner: true } });
        await this.organizationsService.createForUser(user.id, tx);
      });

      this.logger.log(`Usuario ${user.email} activado como Owner`);
    }

    if (dto.role === UserRole.AFFILIATE) {
      if (user.isAffiliate) throw new BadRequestException('El usuario ya es Afiliado');

      const affiliateCode = await this.generateUniqueAffiliateCode();

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { isAffiliate: true, affiliateCode },
        });
        await tx.affiliateData.create({
          data: { userId: user.id, balance: 0, referralCount: 0 },
        });
      });

      this.logger.log(`Usuario ${user.email} activado como Affiliate con código: ${affiliateCode}`);
    }

    const profile = await this.buildProfile(firebaseUid);
    return {
      success: true,
      message: dto.role === UserRole.OWNER
        ? 'Rol Owner activado. Organización creada exitosamente.'
        : 'Rol Afiliado activado. Código de referido generado.',
      data: profile,
    };
  }

  async getDashboardAccess(firebaseUid: string): Promise<{
    canAccess: boolean;
    role?:     'OWNER' | 'COLLABORATOR';
    email?:    string;
    nombre?:   string;
    reason?:   string;
  }> {
    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: {
        organization:   { select: { id: true, name: true } },
        collaborations: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });

    if (!user) return { canAccess: false, reason: 'Usuario no encontrado' };
    if (user.isOwner) {
      return { canAccess: true, role: 'OWNER', email: user.email ?? undefined, nombre: user.displayName ?? undefined };
    }
    if (user.collaborations.length > 0) {
      return { canAccess: true, role: 'COLLABORATOR', email: user.email ?? undefined, nombre: user.displayName ?? undefined };
    }
    return { canAccess: false, reason: 'No es Owner ni Colaborador activo' };
  }

  /**
   * GET /auth/organization-access
   *
   * Resuelve si `firebaseUid` tiene acceso a `organizationId` y con qué
   * rol/permisos. Contrato consumido por real-config-back y otros sistemas hoja.
   *
   * Casos:
   *  1. OWNER de esa org     → permisos completos
   *  2. COLLABORATOR activo  → permisos reales de la tabla collaborators
   *  3. Sin relación         → { canAccess: false }
   */
  async getOrganizationAccess(
    firebaseUid: string,
    organizationId: string,
  ): Promise<OrganizationAccessResult> {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        organization: { select: { id: true } },
        collaborations: {
          where: { organizationId, status: 'ACTIVE' },
          select: { permissions: true },
        },
      },
    });

    if (!user) {
      return { canAccess: false, reason: 'Usuario no encontrado' };
    }

    // Caso 1: owner de esa organización
    if (user.isOwner && user.organization?.id === organizationId) {
      return {
        canAccess:      true,
        userId:         user.id,
        organizationId,
        role:           'OWNER',
        permissions: {
          canViewListings:        true,
          canCreateListings:      true,
          canEditListings:        true,
          canDeleteListings:      true,
          canViewStats:           true,
          canManageLeads:         true,
          canManageCollaborators: true,
        },
      };
    }

    // Caso 2: colaborador activo de esa organización
    const collab = (user as any).collaborations?.[0];
    if (collab) {
      return {
        canAccess:      true,
        userId:         user.id,
        organizationId,
        role:           'COLLABORATOR',
        permissions: {
          canViewListings:        parseCollabPermissions(collab.permissions).canViewListings,
          canCreateListings:      parseCollabPermissions(collab.permissions).canCreateListings,
          canEditListings:        parseCollabPermissions(collab.permissions).canEditListings,
          canDeleteListings:      parseCollabPermissions(collab.permissions).canDeleteListings,
          canViewStats:           parseCollabPermissions(collab.permissions).canViewStats,
          canManageLeads:         parseCollabPermissions(collab.permissions).canManageLeads,
          canManageCollaborators: parseCollabPermissions(collab.permissions).canManageCollaborators,
        },
      };
    }

    return {
      canAccess: false,
      reason:    'El usuario no tiene acceso a esta organización',
    };
  }

  private async generateUniqueAffiliateCode(): Promise<string> {
    let code = '';
    let exists = true;
    while (exists) {
      const raw = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
      code = `RE-${raw}`;
      const found = await this.prisma.user.findUnique({ where: { affiliateCode: code } });
      exists = !!found;
    }
    return code;
  }
}
