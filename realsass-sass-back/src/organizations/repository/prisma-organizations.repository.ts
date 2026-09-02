import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { IOrganizationsRepository } from './organizations.repository.interface';
import type { Organization, UpdateOrganizationInput, CreateOrganizationInput, StoreInfo } from '../domain/organization.entity';

type PrismaOrg = Prisma.OrganizationGetPayload<Record<string, never>>;

@Injectable()
export class PrismaOrganizationsRepository implements IOrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaOrg): Organization {
    return {
      id:              row.id,
      firebaseUid:     '',   // viene del join con User — no disponible en el modelo directo
      slug:            row.slug,
      name:            row.name,
      description:     row.description,
      logoUrl:         row.logoUrl,
      website:         row.website,
      // @real/jsonb-cast — Prisma devuelve JsonValue para campos Json
      enabledProducts: row.enabledProducts as Record<string, unknown>,
      plan:            'free',
      createdAt:       row.createdAt,
      updatedAt:       row.updatedAt,
    };
  }

  async findByFirebaseUid(firebaseUid: string): Promise<Organization | null> {
    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: { organization: true },
    });
    return user?.organization ? this.toEntity(user.organization) : null;
  }

  async findByUserId(userId: string): Promise<Organization | null> {
    const user = await this.prisma.user.findUnique({
      where:   { id: userId },
      include: { organization: true },
    });
    return user?.organization ? this.toEntity(user.organization) : null;
  }

  async findBySlug(slug: string): Promise<StoreInfo | null> {
    const org = await this.prisma.organization.findFirst({
      where: { slug },
      select: {
        id: true, slug: true, name: true,
        description: true, logoUrl: true, website: true,
        enabledProducts: true,
      },
    });
    if (!org || !org.slug) return null;
    // @real/jsonb-cast
    const ep = (org.enabledProducts as Record<string, unknown>) ?? {};
    return {
      organizationId:   org.id,
      slug:             org.slug,
      name:             org.name,
      description:      org.description,
      logoUrl:          org.logoUrl,
      website:          org.website,
      ecommerceEnabled: !!ep['ecommerce'],
    };
  }

  async create(input: CreateOrganizationInput, tx?: Prisma.TransactionClient): Promise<Organization> {
    const client = tx ?? this.prisma;
    const row    = await client.organization.create({
      data: {
        user:            { connect: { id: input.userId } },
        slug:            `org-${input.userId}`,
        enabledProducts: {},
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, input: UpdateOrganizationInput): Promise<Organization> {
    const row = await this.prisma.organization.update({ where: { id }, data: input });
    return this.toEntity(row);
  }
}
