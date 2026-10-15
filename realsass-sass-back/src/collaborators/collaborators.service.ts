import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Logger, Inject,
} from '@nestjs/common';
import { PrismaService }       from '@/prisma/prisma.service';
import { COLLABORATORS_REPOSITORY, type ICollaboratorsRepository } from '@/collaborators/repository/collaborators.repository.interface';
import type { CollaboratorPermissions } from '@/collaborators/domain/collaborator.entity';

interface InviteCollaboratorDto {
  email:                  string;
  canViewListings?:       boolean;
  canCreateListings?:     boolean;
  canEditListings?:       boolean;
  canDeleteListings?:     boolean;
  canViewStats?:          boolean;
  canManageLeads?:        boolean;
  canManageCollaborators?: boolean;
}

interface UpdateCollaboratorDto {
  canViewListings?:       boolean;
  canCreateListings?:     boolean;
  canEditListings?:       boolean;
  canDeleteListings?:     boolean;
  canViewStats?:          boolean;
  canManageLeads?:        boolean;
  canManageCollaborators?: boolean;
}

const INVITE_EXPIRY_DAYS = 7;

function defaultPermissions(): CollaboratorPermissions {
  return {
    canViewListings: true, canCreateListings: false, canEditListings: false,
    canDeleteListings: false, canViewStats: false, canManageLeads: false,
    canManageCollaborators: false,
  };
}

@Injectable()
export class CollaboratorsService {
  private readonly logger = new Logger(CollaboratorsService.name);

  constructor(
    @Inject(COLLABORATORS_REPOSITORY)
    private readonly repo: ICollaboratorsRepository,
    // PrismaService se mantiene solo para la transacción de invitación
    // que crea Collaborator + Invitation atómicamente.
    // Una vez que ICollaboratorsRepository soporte transacciones, se elimina.
    private readonly prisma: PrismaService,
  ) {}

  async listCollaborators(firebaseUid: string, activeOrganizationId?: string | null) {
    const org = await this.getOrgForOwner(firebaseUid, activeOrganizationId);
    return this.repo.findAllByOrganization(org.id);
  }

  async inviteCollaborator(firebaseUid: string, dto: InviteCollaboratorDto, activeOrganizationId?: string | null) {
    const org = await this.getOrgForOwner(firebaseUid, activeOrganizationId);

    // Verificar que no se invite a sí mismo
    const owner = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (owner?.email === dto.email) {
      throw new BadRequestException('Cannot invite yourself');
    }

    // Verificar invitación existente
    const existing = await this.repo.findByEmail(dto.email, org.id);
    if (existing && existing.status === 'ACTIVE') {
      throw new BadRequestException('Collaborator already active');
    }

    const permissions: CollaboratorPermissions = {
      ...defaultPermissions(),
      canViewListings:       dto.canViewListings       ?? true,
      canCreateListings:     dto.canCreateListings     ?? false,
      canEditListings:       dto.canEditListings        ?? false,
      canDeleteListings:     dto.canDeleteListings      ?? false,
      canViewStats:          dto.canViewStats           ?? false,
      canManageLeads:        dto.canManageLeads         ?? false,
      canManageCollaborators: dto.canManageCollaborators ?? false,
    };

    // Si estaba REMOVED, reactivar con nueva invitación
    if (existing && existing.status === 'REMOVED') {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
      await this.prisma.$transaction([
        this.prisma.collaborator.update({
          where: { id: existing.id },
          data: { status: 'PENDING', permissions: { ...permissions } },
        }),
        this.prisma.invitation.upsert({
          where:  { collaboratorId: existing.id },
          update: { token: crypto.randomUUID(), expiresAt, usedAt: null },
          create: { collaboratorId: existing.id, token: crypto.randomUUID(), expiresAt },
        }),
      ]);
      const updated = await this.repo.findById(existing.id, org.id);
      return { collaborator: updated, inviteLink: this.buildLink(org.id, existing.id) };
    }

    // Crear nuevo collaborator + invitation en transacción
    const collaboratorId = crypto.randomUUID();
    const expiresAt      = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    await this.prisma.$transaction([
      this.prisma.collaborator.create({
        data: { id: collaboratorId, organizationId: org.id, email: dto.email, status: 'PENDING', permissions: { ...permissions } },
      }),
      this.prisma.invitation.create({
        data: { collaboratorId, token: crypto.randomUUID(), expiresAt },
      }),
    ]);

    const collaborator = await this.repo.findById(collaboratorId, org.id);
    return { collaborator, inviteLink: this.buildLink(org.id, collaboratorId) };
  }

  async updateCollaborator(firebaseUid: string, collaboratorId: string, dto: UpdateCollaboratorDto, activeOrganizationId?: string | null) {
    const org = await this.getOrgForOwner(firebaseUid, activeOrganizationId);
    const col = await this.repo.findById(collaboratorId, org.id);
    if (!col) throw new NotFoundException('Collaborator not found');
    return this.repo.update(collaboratorId, { permissions: dto });
  }

  async removeCollaborator(firebaseUid: string, collaboratorId: string, activeOrganizationId?: string | null) {
    const org = await this.getOrgForOwner(firebaseUid, activeOrganizationId);
    const col = await this.repo.findById(collaboratorId, org.id);
    if (!col) throw new NotFoundException('Collaborator not found');
    await this.repo.remove(collaboratorId);
  }

  async getInvitationInfo(token: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { token },
      include: { collaborator: { include: { organization: true } } },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.expiresAt < new Date()) throw new BadRequestException('Invitation expired');
    return inv;
  }

  /** Público (sin auth): solo lo que necesita la pantalla de invitación, nunca el token ni ids internos. */
  async getPublicInvitationInfo(token: string) {
    const inv = await this.getInvitationInfo(token);
    return {
      expiresAt: inv.expiresAt,
      used:      inv.usedAt !== null,
      collaborator: {
        email:        inv.collaborator.email,
        organization: { name: inv.collaborator.organization.name },
      },
    };
  }

  async acceptInvitation(token: string, firebaseUid: string) {
    const inv = await this.getInvitationInfo(token);
    // Una invitación se usa UNA vez. Sin esto, un colaborador removido conservaba el token (vigente 7 días)
    // y podía volver a aceptarlo, recuperando el acceso que el dueño le había quitado.
    if (inv.usedAt) throw new BadRequestException('Invitation already used');
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('User not found');
    if (inv.collaborator.email !== user.email) throw new ForbiddenException('Email mismatch');

    await this.prisma.$transaction([
      this.prisma.collaborator.update({
        where: { id: inv.collaboratorId },
        data: { status: 'ACTIVE', userId: user.id, acceptedAt: new Date() },
      }),
      this.prisma.invitation.update({
        where: { id: inv.id }, data: { usedAt: new Date() },
      }),
    ]);
  }

  // ── Privados ────────────────────────────────────────────────────────────────

  /** D3/D4: la organización propia indicada por el header; si no es propia o falta, la más antigua. */
  private async getOrgForOwner(firebaseUid: string, activeOrganizationId?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid }, include: { organizations: { orderBy: { createdAt: 'asc' } } },
    });
    const org = (activeOrganizationId ? user?.organizations.find(o => o.id === activeOrganizationId) : undefined)
      ?? user?.organizations[0];
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  private buildLink(organizationId: string, collaboratorId: string): string {
    return `/invite/${collaboratorId}`;
  }
}
