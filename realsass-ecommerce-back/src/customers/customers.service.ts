import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma }   from '@prisma/client';
import type { CustomerOutput, IdentifyCustomerOutput } from './types/customer.types';

type PrismaCustomer = Prisma.StoreCustomerGetPayload<Record<string, never>>;

function toCustomerOutput(row: PrismaCustomer): CustomerOutput {
  return {
    id:             row.id,
    organizationId: row.organizationId,
    email:          row.email,
    displayName:    row.displayName,
    phone:          row.phone,
    createdAt:      row.createdAt,
    updatedAt:      row.updatedAt,
  };
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Identifica (o crea) al cliente por email, scoped a la organización.
   * Si viene cartId, adopta el carrito anónimo al cliente identificado.
   */
  async identify(
    organizationId: string,
    email:          string,
    displayName?:   string,
    phone?:         string,
    cartId?:        string,
  ): Promise<IdentifyCustomerOutput> {
    const existing = await this.prisma.storeCustomer.findFirst({
      where: { organizationId, email },
    });

    let customer: PrismaCustomer;
    let isNew = false;

    if (existing) {
      customer = existing;
      // Actualizar datos si vinieron
      if (displayName || phone) {
        customer = await this.prisma.storeCustomer.update({
          where: { id: existing.id },
          data:  { ...(displayName ? { displayName } : {}), ...(phone ? { phone } : {}) },
        });
      }
    } else {
      customer = await this.prisma.storeCustomer.create({
        data: { organizationId, email, displayName, phone },
      });
      isNew = true;
    }

    // Adoptar carrito anónimo si viene
    if (cartId) {
      await this.prisma.cart.updateMany({
        where: { id: cartId, organizationId, customerId: null },
        data:  { customerId: customer.id },
      });
    }

    return { customerId: customer.id, isNew };
  }

  async findById(organizationId: string, customerId: string): Promise<CustomerOutput> {
    const row = await this.prisma.storeCustomer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!row) throw new NotFoundException(`Customer ${customerId} not found`);
    return toCustomerOutput(row);
  }
}
