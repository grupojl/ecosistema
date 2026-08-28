import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ICollaboratorsRepository } from './collaborators.repository.interface';
import type { Collaborator, InviteCollaboratorInput, UpdateCollaboratorInput } from '../domain/collaborator.entity';

function parsePermissions(raw: unknown) {
  const defaults = {
    canViewListings: true, canCreateListings: false, canEditListings: false,
    canDeleteListings: false, canViewStats: false, canManageLeads: false,
    canManageCollaborators: false,
  };
  if (!raw || typeof raw !== 'object') return defaults;
  return { ...defaults, ...(raw as object) };
}

@Injectable()
export class PrismaCollaboratorsRepository implements ICollaboratorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOrganization(organizationId: string): Promise<Collaborator[]> {
    const rows = await this.prisma.collaborator.findMany({
      where: { organizationId, status: { not: 'REMOVED' } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(r => ({ ...r, permissions: parsePermissions(r.permissions) })) as unknown as Collaborator[];
  }

  async findById(id: string, organizationId: string): Promise<Collaborator | null> {
    const row = await this.prisma.collaborator.findFirst({ where: { id, organizationId } });
    if (!row) return null;
    return { ...row, permissions: parsePermissions(row.permissions) } as unknown as Collaborator;
  }

  async findByEmail(email: string, organizationId: string): Promise<Collaborator | null> {
    const row = await this.prisma.collaborator.findFirst({ where: { email, organizationId } });
    if (!row) return null;
    return { ...row, permissions: parsePermissions(row.permissions) } as unknown as Collaborator;
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
    return { ...row, permissions: parsePermissions(row.permissions) } as unknown as Collaborator;
  }

  async update(id: string, input: UpdateCollaboratorInput): Promise<Collaborator> {
    const existing = await this.prisma.collaborator.findUniqueOrThrow({ where: { id } });
    const merged   = { ...parsePermissions(existing.permissions), ...input.permissions };
    const row      = await this.prisma.collaborator.update({ where: { id }, data: { permissions: merged } });
    return { ...row, permissions: parsePermissions(row.permissions) } as unknown as Collaborator;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.collaborator.update({ where: { id }, data: { status: 'REMOVED' } });
  }
}
