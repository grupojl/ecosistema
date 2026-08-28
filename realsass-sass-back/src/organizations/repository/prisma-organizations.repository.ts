import { Injectable }      from '@nestjs/common';
import { PrismaService }   from '../../prisma/prisma.service';
import { Prisma }          from '@prisma/client';
import type { IOrganizationsRepository } from './organizations.repository.interface';
import type { Organization, UpdateOrganizationInput, CreateOrganizationInput, StoreInfo } from '../domain/organization.entity';

@Injectable()
export class PrismaOrganizationsRepository implements IOrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByFirebaseUid(firebaseUid: string): Promise<Organization | null> {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { organization: true },
    });
    return user?.organization ?? null;
  }

  async findByUserId(userId: string): Promise<Organization | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    return user?.organization ?? null;
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
    const ep = (org.enabledProducts as Record<string, unknown>) ?? {};
    return {
      organizationId:   org.id,
      slug:             org.slug,
      name:             org.name,
      description:      org.description,
      logoUrl:          org.logoUrl,
      website:          org.website,
      ecommerceEnabled: !!(ep['ecommerce']),
    };
  }

  async create(input: CreateOrganizationInput, tx?: Prisma.TransactionClient): Promise<Organization> {
    const client = tx ?? this.prisma;
    return client.organization.create({
      data: {
        user:      { connect: { id: input.userId } },
        slug:      `org-${input.userId}`,
        plan:      'free',
        enabledProducts: {},
      },
    }) as unknown as Organization;
  }

  async update(id: string, input: UpdateOrganizationInput): Promise<Organization> {
    return this.prisma.organization.update({
      where: { id },
      data:  input,
    }) as unknown as Organization;
  }
}
