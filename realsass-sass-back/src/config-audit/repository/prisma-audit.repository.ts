import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { IAuditRepository } from './audit.repository.interface';
import type { AuditLog, CreateAuditLogInput, AuditLogFilters } from '../domain/audit-log.entity';

@Injectable()
export class PrismaAuditRepository implements IAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAuditLogInput): Promise<void> {
    await this.prisma.configAuditLog.create({ data: input });
  }

  async findByOrg(organizationId: string, filters: AuditLogFilters, take: number, skip: number): Promise<AuditLog[]> {
    return this.prisma.configAuditLog.findMany({
      where: {
        organizationId,
        ...(filters.configType ? { configType: filters.configType } : {}),
        ...(filters.userId     ? { userId:     filters.userId     } : {}),
        ...(filters.from || filters.to ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to   ? { lte: filters.to   } : {}),
          },
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }) as unknown as AuditLog[];
  }
}
