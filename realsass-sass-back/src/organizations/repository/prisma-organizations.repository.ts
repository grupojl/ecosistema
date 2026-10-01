import { Injectable }    from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { z }             from 'zod';
import type { Prisma }   from '@prisma/client';
import type { IOrganizationsRepository } from '@/organizations/repository/organizations.repository.interface';
import {
  toPublicStoreInfo,
  type Organization,
  type UpdateOrganizationInput,
  type CreateOrganizationInput,
  type StoreInfo,
} from '@/domain/organization.entity';

type PrismaOrg = Prisma.OrganizationGetPayload<Record<string, never>>;

// Zod schema para el campo Json "enabledProducts" de Prisma
const EnabledProductsSchema = z.record(z.unknown()).catch({});

@Injectable()
export class PrismaOrganizationsRepository implements IOrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaOrg): Organization {
    return {
      id:              row.id,
      firebaseUid:     '',
      slug:            row.slug,
      name:            row.name,
      description:     row.description,
      logoUrl:         row.logoUrl,
      website:         row.website,
      enabledProducts: EnabledProductsSchema.parse(row.enabledProducts),
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
    const row = await this.prisma.organization.findUnique({
      where:  { slug },
      select: {
        id: true, slug: true, name: true, description: true,
        logoUrl: true, website: true, countryCode: true, storeStatus: true,
      },
    });
    return row ? toPublicStoreInfo(row) : null;
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
