import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { ICustomersRepository, CustomerRecord, CustomerContactPatch } from '@/customers/repository/customers.repository.interface';
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

  async anonymize(organizationId: string, customerId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.storeCustomer.findFirst({ where: { id: customerId, organizationId }, select: { id: true } });
      if (!found) return false;
      await tx.customerAddress.deleteMany({ where: { customerId } });
      await tx.storeCustomer.update({
        where: { id: customerId },
        data: { email: `deleted_${randomUUID()}@deleted.local`, displayName: null, phone: null, isGuest: true },
      });
      return true;
    });
  }

  async createGuest(organizationId: string): Promise<CustomerRecord> {
    const created = await this.prisma.storeCustomer.create({
      data: { organizationId, email: `guest_${randomUUID()}@guest.local`, isGuest: true },
    });
    return this.toEntity(created);
  }

  async findById(organizationId: string, customerId: string): Promise<CustomerRecord | null> {
    const row = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, organizationId },
    });
    return row ? this.toEntity(row) : null;
  }

  async attachContact(
    organizationId: string,
    customerId:     string,
    patch:          CustomerContactPatch,
  ): Promise<CustomerRecord> {
    let email = patch.email?.trim().toLowerCase();
    if (email) {
      const taken = await this.prisma.storeCustomer.findFirst({
        where:  { organizationId, email, NOT: { id: customerId } },
        select: { id: true },
      });
      if (taken) email = undefined; // no se enlaza una cuenta ajena ni se revela que existe
    }
    const data = {
      ...(email              && { email }),
      ...(patch.displayName  && { displayName: patch.displayName }),
      ...(patch.phone        && { phone:       patch.phone }),
    };
    if (Object.keys(data).length === 0) {
      const current = await this.findById(organizationId, customerId);
      if (!current) throw new Error(`Cliente ${customerId} no encontrado`);
      return current;
    }
    const row = await this.prisma.storeCustomer.update({ where: { id: customerId }, data });
    return this.toEntity(row);
  }

  async update(
    organizationId: string,
    customerId:     string,
    patch: CustomerContactPatch,
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
