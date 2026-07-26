import {
  CanActivate, ExecutionContext, ForbiddenException,
  Injectable, UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CollaboratorPermissions {
  canViewListings:        boolean;
  canCreateListings:      boolean;
  canEditListings:        boolean;
  canDeleteListings:      boolean;
  canViewStats:           boolean;
  canManageLeads:         boolean;
  canManageCollaborators: boolean;
}

export interface TenantContext {
  userId:         string;
  organizationId: string;
  role:           'OWNER' | 'COLLABORATOR';
  permissions:    CollaboratorPermissions;
}

const FULL_PERMISSIONS: CollaboratorPermissions = {
  canViewListings:        true,
  canCreateListings:      true,
  canEditListings:        true,
  canDeleteListings:      true,
  canViewStats:           true,
  canManageLeads:         true,
  canManageCollaborators: true,
};

/**
 * Resuelve TenantContext leyendo Prisma directo.
 * S1: reemplaza el patrón HTTP hacia OrganizationsClientService — ahora
 * estamos en el mismo proceso, no tiene sentido llamar a sí mismo por HTTP.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req            = ctx.switchToHttp().getRequest();
    const user           = req.user as { uid: string } | undefined;
    const organizationId = req.headers['x-organization-id'] as string | undefined;

    if (!organizationId) throw new ForbiddenException('Header x-organization-id requerido');
    if (!user?.uid)      throw new UnauthorizedException('Usuario no autenticado');

    const dbUser = await this.prisma.user.findUnique({
      where:   { firebaseUid: user.uid },
      include: {
        organization:   { select: { id: true } },
        collaborations: {
          where:  { organizationId, status: 'ACTIVE' },
          select: { id: true, userId: true, permissions: true },
        },
      },
    });

    if (!dbUser) throw new UnauthorizedException('Usuario no encontrado');

    // Caso 1: OWNER de esa org
    if (dbUser.isOwner && dbUser.organization?.id === organizationId) {
      const tenant: TenantContext = {
        userId: dbUser.id,
        organizationId,
        role: 'OWNER',
        permissions: FULL_PERMISSIONS,
      };
      req.tenant = tenant;
      return true;
    }

    // Caso 2: COLLABORATOR activo
    const collab = dbUser.collaborations[0];
    if (collab) {
      const tenant: TenantContext = {
        userId: dbUser.id,
        organizationId,
        role: 'COLLABORATOR',
        permissions: ((collab.permissions as unknown) as CollaboratorPermissions) ?? {},
      };
      req.tenant = tenant;
      return true;
    }

    throw new ForbiddenException('No tenés acceso a esta organización');
  }
}
