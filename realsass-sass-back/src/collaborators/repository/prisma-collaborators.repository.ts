import { Injectable }    from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { z }             from 'zod';
import type { Prisma }   from '@/generated/prisma';
import type { ICollaboratorsRepository } from '@/collaborators/repository/collaborators.repository.interface';
import type {
  Collaborator, CollaboratorPermissions,
  InviteCollaboratorInput, UpdateCollaboratorInput,
} from '@/domain/collaborator.entity';

type PrismaCollab = Prisma.CollaboratorGetPayload<Record<string, never>>;

const DEFAULT_PERMISSIONS: CollaboratorPermissions = {
  canViewListings: true, canCreateListings: false, canEditListings: false,
  canDeleteListings: false, canViewStats: false, canManageLeads: false,
  canManageCollaborators: false,
};

// Zod schema para el campo Json "permissions" de Prisma
const CollaboratorPermissionsSchema = z.object({
  canViewListings:       z.boolean().optional(),
  canCreateListings:     z.boolean().optional(),
  canEditListings:       z.boolean().optional(),
  canDeleteListings:     z.boolean().optional(),
  canViewStats:          z.boolean().optional(),
  canManageLeads:        z.boolean().optional(),
  canManageCollaborators: z.boolean().optional(),
}).catch({});

@Injectable()
export class PrismaCollaboratorsRepository implements ICollaboratorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaCollab): Collaborator {
    const parsedPermissions = CollaboratorPermissionsSchema.parse(row.permissions ?? {});
    return {
      id:             row.id,
      organizationId: row.organizationId,
      userId:         row.userId,
      email:          row.email,
      status:         row.status as Collaborator['status'],
      permissions:    { ...DEFAULT_PERMISSIONS, ...parsedPermissions },
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
    const parsedExisting = CollaboratorPermissionsSchema.parse(existing.permissions ?? {});
    const merged = { ...DEFAULT_PERMISSIONS, ...parsedExisting, ...input.permissions };
    const row = await this.prisma.collaborator.update({ where: { id }, data: { permissions: merged } });
    return this.toEntity(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.collaborator.update({ where: { id }, data: { status: 'REMOVED' } });
  }
}
