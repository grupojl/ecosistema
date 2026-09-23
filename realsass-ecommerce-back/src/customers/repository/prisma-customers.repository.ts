/**
 * repository/prisma-customers.repository.ts — realsass-ecommerce-back
 *
 * Adaptador concreto de ICustomersRepository usando Prisma.
 * ÚNICO archivo del módulo customers que puede importar PrismaService.
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import type { ICustomersRepository, CustomerRecord } from "@/customers/repository/customers.repository.interface";

@Injectable()
export class PrismaCustomersRepository implements ICustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async identifyBySession(
    organizationId: string,
    sessionId:      string,
  ): Promise<CustomerRecord> {
    const existing = await this.prisma.customer.findFirst({
      where: { organizationId, sessionId },
    });
    if (existing) return existing as CustomerRecord;

    const created = await this.prisma.customer.create({
      data: { organizationId, sessionId },
    });
    return created as CustomerRecord;
  }

  async findById(organizationId: string, customerId: string): Promise<CustomerRecord | null> {
    const c = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    return c as CustomerRecord | null;
  }

  async findBySessionId(organizationId: string, sessionId: string): Promise<CustomerRecord | null> {
    const c = await this.prisma.customer.findFirst({
      where: { organizationId, sessionId },
    });
    return c as CustomerRecord | null;
  }

  async update(
    organizationId: string,
    customerId:     string,
    patch: { email?: string; name?: string; phone?: string },
  ): Promise<CustomerRecord> {
    const c = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(patch.email !== undefined && { email: patch.email }),
        ...(patch.name  !== undefined && { name:  patch.name  }),
        ...(patch.phone !== undefined && { phone: patch.phone }),
      },
    });
    return c as CustomerRecord;
  }

  async listByOrg(
    organizationId: string,
    filters?: { search?: string; page?: number; limit?: number },
  ): Promise<{ items: CustomerRecord[]; total: number }> {
    const page  = filters?.page  ?? 1;
    const limit = filters?.limit ?? 20;
    const skip  = (page - 1) * limit;

    const searchWhere = filters?.search
      ? {
          OR: [
            { email: { contains: filters.search, mode: "insensitive" as const } },
            { name:  { contains: filters.search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const where = { organizationId, ...searchWhere };

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.customer.count({ where }),
    ]);

    return { items: items as CustomerRecord[], total };
  }
}
