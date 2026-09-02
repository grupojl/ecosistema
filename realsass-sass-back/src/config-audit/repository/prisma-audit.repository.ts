import { Injectable }    from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { IAuditRepository } from './audit.repository.interface';
import type { AuditLog, CreateAuditLogInput, AuditLogFilters } from '../domain/audit-log.entity';

type PrismaAuditLog = Prisma.ConfigAuditLogGetPayload<Record<string, never>>;

@Injectable()
export class PrismaAuditRepository implements IAuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaAuditLog): AuditLog {
    return {
      id:             row.id,
      organizationId: row.organizationId,
      userId:         row.userId,
      configType:     row.configType,
      configKey:      row.configKey,
      action:         row.action,
      previousValue:  row.previousValue,
      newValue:       row.newValue,
      // @real/jsonb-cast — Prisma devuelve JsonValue para campos Json
      diff:           row.diff as Record<string, unknown> | null,
      reason:         row.reason,
      ipAddress:      row.ipAddress,
      createdAt:      row.createdAt,
    };
  }

  async create(input: CreateAuditLogInput): Promise<void> {
    await this.prisma.configAuditLog.create({ data: input });
  }

  async findByOrg(
    organizationId: string,
    filters: AuditLogFilters,
    take: number,
    skip: number,
  ): Promise<AuditLog[]> {
    const rows = await this.prisma.configAuditLog.findMany({
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
    });
    return rows.map(r => this.toEntity(r));
  }
}
