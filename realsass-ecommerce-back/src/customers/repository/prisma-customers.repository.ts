import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { ICustomersRepository, CustomerRecord } from '@/customers/repository/customers.repository.interface';
import type { Prisma } from '@/generated/prisma';

type PrismaStoreCustomer = Prisma.StoreCustomerGetPayload<Record<string, never>>;

@Injectable()
export class PrismaCustomersRepository implements ICustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: PrismaStoreCustomer): CustomerRecord {
    return {
      id:             row.id,
      organizationId: row.organizationId,
      email:          row.email,
      displayName:    row.displayName,
      phone:          row.phone,
      isGuest:        row.isGuest,
      createdAt:      row.createdAt,
      updatedAt:      row.updatedAt,
    };
  }

  async upsertByEmail(
    organizationId: string,
    email:          string,
    patch:          { displayName?: string; phone?: string },
  ): Promise<{ customer: CustomerRecord; created: boolean }> {
    // Antes devolvía el PRIMER invitado de la organización sin mirar quién preguntaba: todos los visitantes
    // compartían el mismo customerId (y por lo tanto carrito, perfil y pedidos). Ahora es uno por email.
    const where = { organizationId_email: { organizationId, email } };
    const existing = await this.prisma.storeCustomer.findUnique({ where });

    if (existing) {
      const needsUpdate =
        (patch.displayName !== undefined && patch.displayName !== existing.displayName) ||
        (patch.phone !== undefined && patch.phone !== existing.phone) ||
        existing.isGuest;
      if (!needsUpdate) return { customer: this.toEntity(existing), created: false };

      const updated = await this.prisma.storeCustomer.update({
        where,
        data: {
          isGuest: false,
          ...(patch.displayName !== undefined && { displayName: patch.displayName }),
          ...(patch.phone !== undefined && { phone: patch.phone }),
        },
      });
      return { customer: this.toEntity(updated), created: false };
    }

    const created = await this.prisma.storeCustomer.create({
      data: { organizationId, email, isGuest: false, displayName: patch.displayName ?? null, phone: patch.phone ?? null },
    });
    return { customer: this.toEntity(created), created: true };
  }

  async findById(organizationId: string, customerId: string): Promise<CustomerRecord | null> {
    const row = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, organizationId },
    });
    return row ? this.toEntity(row) : null;
  }

  async findBySessionId(organizationId: string, sessionId: string): Promise<CustomerRecord | null> {
    const row = await this.prisma.storeCustomer.findFirst({
      where: { organizationId, email: `guest_${sessionId}@guest.local` },
    });
    return row ? this.toEntity(row) : null;
  }

  async update(
    organizationId: string,
    customerId:     string,
    patch: { email?: string; displayName?: string; phone?: string },
  ): Promise<CustomerRecord> {
    const row = await this.prisma.storeCustomer.update({
      where: { id: customerId },
      data: {
        ...(patch.email       !== undefined && { email:       patch.email }),
        ...(patch.displayName !== undefined && { displayName: patch.displayName }),
        ...(patch.phone       !== undefined && { phone:       patch.phone }),
      },
    });
    return this.toEntity(row);
  }

  async listByOrg(
    organizationId: string,
    filters?: { search?: string; page?: number; limit?: number },
  ): Promise<{ items: CustomerRecord[]; total: number }> {
    const page  = filters?.page  ?? 1;
    const limit = filters?.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: Prisma.StoreCustomerWhereInput = {
      organizationId,
      ...(filters?.search && {
        OR: [
          { email:       { contains: filters.search, mode: 'insensitive' } },
          { displayName: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.storeCustomer.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.storeCustomer.count({ where }),
    ]);

    return { items: rows.map(r => this.toEntity(r)), total };
  }
}
