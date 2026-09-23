/**
 * repository/prisma-orders.repository.ts — realsass-ecommerce-back
 *
 * Adaptador concreto de IOrdersRepository usando Prisma.
 * ÚNICO archivo del módulo orders que puede importar PrismaService.
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import type { IOrdersRepository, OrderRecord, CreateOrderInput } from "@/orders/repository/orders.repository.interface";
import type { OrderStatus } from "@/domain/order.errors";

const ORDER_WITH_ITEMS = {
  items: {
    include: {
      variant: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  },
} as const;

@Injectable()
export class PrismaOrdersRepository implements IOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, orderId: string): Promise<OrderRecord | null> {
    const order = await this.prisma.order.findFirst({
      where:   { id: orderId, organizationId },
      include: ORDER_WITH_ITEMS,
    });
    return order as OrderRecord | null;
  }

  async findBySession(organizationId: string, sessionId: string): Promise<OrderRecord[]> {
    const orders = await this.prisma.order.findMany({
      where:   { organizationId, sessionId },
      include: ORDER_WITH_ITEMS,
      orderBy: { createdAt: "desc" },
    });
    return orders as OrderRecord[];
  }

  async listByOrg(
    organizationId: string,
    filters?: { status?: OrderStatus; page?: number; limit?: number },
  ): Promise<{ items: OrderRecord[]; total: number }> {
    const page  = filters?.page  ?? 1;
    const limit = filters?.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where = {
      organizationId,
      ...(filters?.status && { status: filters.status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: ORDER_WITH_ITEMS,
        orderBy: { createdAt: "desc" },
        skip,
        take:    limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items: orders as OrderRecord[], total };
  }

  async create(input: CreateOrderInput): Promise<OrderRecord> {
    const order = await this.prisma.order.create({
      data: {
        organizationId:  input.organizationId,
        sessionId:       input.sessionId,
        status:          "PENDING",
        totalCents:      input.totalCents,
        currency:        input.currency,
        shippingAddress: (input.shippingAddress ?? null) as never,
        items: {
          create: input.items.map((item) => ({
            variantId:  item.variantId,
            quantity:   item.quantity,
            priceCents: item.priceCents,
            currency:   item.currency,
          })),
        },
      },
      include: ORDER_WITH_ITEMS,
    });
    return order as OrderRecord;
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<OrderRecord> {
    const order = await this.prisma.order.update({
      where:   { id: orderId },
      data:    { status },
      include: ORDER_WITH_ITEMS,
    });
    return order as OrderRecord;
  }

  async setPaymentIntent(orderId: string, paymentIntentId: string): Promise<void> {
    await this.prisma.order.update({
      where: { id: orderId },
      data:  { paymentIntentId },
    });
  }
}
