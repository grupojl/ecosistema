import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma';
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
const EnabledProductsSchema = z.record(z.string(), z.unknown()).catch({});

@Injectable()
export class PrismaOrganizationsRepository implements IOrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaOrg): Organization {
    return {
      id: row.id,
      firebaseUid: '',
      slug: row.slug,
      name: row.name,
      description: row.description,
      logoUrl: row.logoUrl,
      website: row.website,
      enabledProducts: EnabledProductsSchema.parse(row.enabledProducts),
      plan: 'free',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByFirebaseUid(firebaseUid: string): Promise<Organization | null> {
    const rows = await this.listByFirebaseUid(firebaseUid);
    return rows[0] ?? null;
  }

  async listByFirebaseUid(firebaseUid: string): Promise<Organization[]> {
    const rows = await this.prisma.organization.findMany({
      where: { user: { firebaseUid } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByUserId(userId: string): Promise<Organization | null> {
    const row = await this.prisma.organization.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return row ? this.toEntity(row) : null;
  }

  countByUserId(userId: string): Promise<number> {
    return this.prisma.organization.count({ where: { userId } });
  }

  async resolveUserId(firebaseUid: string): Promise<string | null> {
    const u = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true },
    });
    return u?.id ?? null;
  }

  async slugExists(slug: string): Promise<boolean> {
    return (await this.prisma.organization.count({ where: { slug } })) > 0;
  }

  async listPublicStores(
    limit: number,
  ): Promise<Array<{ slug: string; countryCode: string; updatedAt: Date }>> {
    const rows = await this.prisma.organization.findMany({
      where: { storeStatus: 'ACTIVE', slug: { not: null } },
      select: { slug: true, countryCode: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return rows.flatMap((r) =>
      r.slug
        ? [{ slug: r.slug, countryCode: r.countryCode, updatedAt: r.updatedAt }]
        : [],
    );
  }

  async findPublicById(id: string): Promise<StoreInfo | null> {
    const row = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        logoUrl: true,
        website: true,
        countryCode: true,
        storeStatus: true,
      },
    });
    return row ? toPublicStoreInfo(row) : null;
  }

  async findBySlug(slug: string): Promise<StoreInfo | null> {
    const row = await this.prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        logoUrl: true,
        website: true,
        countryCode: true,
        storeStatus: true,
      },
    });
    return row ? toPublicStoreInfo(row) : null;
  }

  async create(
    input: CreateOrganizationInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Organization> {
    const client = tx ?? this.prisma;
    const row = await client.organization.create({
      data: {
        user: { connect: { id: input.userId } },
        // Ya no puede derivarse del userId: un usuario puede tener varias organizaciones.
        slug: input.slug ?? `org-${randomBytes(4).toString('hex')}`,
        ...(input.name ? { name: input.name } : {}),
        ...(input.countryCode ? { countryCode: input.countryCode } : {}),
        enabledProducts: {},
      },
    });
    return this.toEntity(row);
  }

  async update(
    id: string,
    input: UpdateOrganizationInput,
  ): Promise<Organization> {
    const row = await this.prisma.organization.update({
      where: { id },
      data: input,
    });
    return this.toEntity(row);
  }
}
