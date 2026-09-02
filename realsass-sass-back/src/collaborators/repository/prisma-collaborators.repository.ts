import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { ICollaboratorsRepository } from './collaborators.repository.interface';
import type {
  Collaborator, CollaboratorPermissions,
  InviteCollaboratorInput, UpdateCollaboratorInput,
} from '../domain/collaborator.entity';

type PrismaCollab = Prisma.CollaboratorGetPayload<Record<string, never>>;

const DEFAULT_PERMISSIONS: CollaboratorPermissions = {
  canViewListings: true, canCreateListings: false, canEditListings: false,
  canDeleteListings: false, canViewStats: false, canManageLeads: false,
  canManageCollaborators: false,
};

@Injectable()
export class PrismaCollaboratorsRepository implements ICollaboratorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaCollab): Collaborator {
    return {
      id:             row.id,
      organizationId: row.organizationId,
      userId:         row.userId,
      email:          row.email,
      // @real/jsonb-cast — Prisma devuelve JsonValue para campos Json
      status:         row.status as Collaborator['status'],
      permissions:    { ...DEFAULT_PERMISSIONS, ...(row.permissions as Partial<CollaboratorPermissions>) },
      createdAt:      row.invitedAt,
      updatedAt:      row.updatedAt,
    };
  }

  async findAllByOrganization(organizationId: string): Promise<Collaborator[]> {
    const rows = await this.prisma.collaborator.findMany({
      where: { organizationId, status: { not: 'REMOVED' } },
      orderBy: { invitedAt: 'asc' },
    });
    return rows.map(r => this.toEntity(r));
  }

  async findById(id: string, organizationId: string): Promise<Collaborator | null> {
    const row = await this.prisma.collaborator.findFirst({ where: { id, organizationId } });
    return row ? this.toEntity(row) : null;
  }

  async findByEmail(email: string, organizationId: string): Promise<Collaborator | null> {
    const row = await this.prisma.collaborator.findFirst({ where: { email, organizationId } });
    return row ? this.toEntity(row) : null;
  }

  async create(input: InviteCollaboratorInput): Promise<Collaborator> {
    const row = await this.prisma.collaborator.create({
      data: {
        organizationId: input.organizationId,
        email:          input.email,
        status:         'PENDING',
        permissions:    input.permissions ?? {},
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, input: UpdateCollaboratorInput): Promise<Collaborator> {
    const existing = await this.prisma.collaborator.findUniqueOrThrow({ where: { id } });
    const merged   = {
      ...DEFAULT_PERMISSIONS,
      ...(existing.permissions as Partial<CollaboratorPermissions>),
      ...input.permissions,
    };
    const row = await this.prisma.collaborator.update({ where: { id }, data: { permissions: merged } });
    return this.toEntity(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.collaborator.update({ where: { id }, data: { status: 'REMOVED' } });
  }
}
