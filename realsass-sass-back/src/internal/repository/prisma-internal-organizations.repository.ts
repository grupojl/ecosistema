import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  IInternalOrganizationsRepository, InternalOrgFilters, InternalOrgRow,
} from '@/internal/repository/internal-organizations.repository.interface';

const SELECT = {
  id: true, ecosystemId: true, name: true, slug: true, status: true, storeStatus: true,
  plan: true, createdAt: true, suspendedAt: true,
} as const;

@Injectable()
export class PrismaInternalOrganizationsRepository implements IInternalOrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: InternalOrgFilters, page: number, limit: number) {
    const { ecosystemId, status, storeStatus, search } = filters;
    const where = {
      ...(ecosystemId ? { ecosystemId } : {}),
      ...(status      ? { status }      : {}),
      ...(storeStatus ? { storeStatus } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.organization.findMany({ where, select: SELECT, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.organization.count({ where }),
    ]);
    return { rows, total };
  }

  findById(id: string): Promise<InternalOrgRow | null> {
    return this.prisma.organization.findUnique({ where: { id }, select: SELECT });
  }

  suspend(id: string, at: Date): Promise<InternalOrgRow> {
    return this.prisma.organization.update({ where: { id }, data: { status: 'SUSPENDED', suspendedAt: at }, select: SELECT });
  }

  unsuspend(id: string): Promise<InternalOrgRow> {
    return this.prisma.organization.update({ where: { id }, data: { status: 'ACTIVE', suspendedAt: null }, select: SELECT });
  }

  setStoreStatus(id: string, storeStatus: 'ACTIVE' | 'PAUSED'): Promise<InternalOrgRow> {
    return this.prisma.organization.update({ where: { id }, data: { storeStatus }, select: SELECT });
  }
}
