/**
 * repository/prisma-orders.repository.ts — realsass-ecommerce-back
 *
 * Adaptador concreto de IOrdersRepository usando Prisma.
 * ÚNICO archivo del módulo orders que puede importar PrismaService.
 */
import { isRecord, toJsonObject } from '@/common/prisma/json';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  IOrdersRepository,
  OrderRecord,
  CreateOrderInput,
} from '@/orders/repository/orders.repository.interface';
import type { OrderStatus } from '@/domain/order.errors';
import { Prisma, $Enums } from '@/generated/prisma';

const ORDER_WITH_ITEMS = {
  items: {
    include: {
      variant: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  },
} as const;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_WITH_ITEMS }>;

/**
 * Fila de Prisma → registro de dominio. `shippingAddress` es una columna Json (desconocida): solo se expone si es un
 * objeto. Antes todo el registro se forzaba con `as OrderRecord`, que escondía este hueco.
 */
function toOrderRecord(row: OrderRow): OrderRecord {
  const { shippingAddress, ...rest } = row;
  return { ...rest, shippingAddress: isRecord(shippingAddress) ? shippingAddress : null };
}

@Injectable()
export class PrismaOrdersRepository implements IOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    organizationId: string,
    orderId: string,
  ): Promise<OrderRecord | null> {
    const order = await this.prisma.forTenant(organizationId).order.findFirst({
      where: { id: orderId, organizationId },
      include: ORDER_WITH_ITEMS,
    });
    return order ? toOrderRecord(order) : null;
  }

  async findByCustomer(
    organizationId: string,
    customerId: string,
  ): Promise<OrderRecord[]> {
    const orders = await this.prisma.forTenant(organizationId).order.findMany({
      where: { organizationId, customerId },
      include: ORDER_WITH_ITEMS,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toOrderRecord);
  }

  async findByCart(
    organizationId: string,
    cartId: string,
  ): Promise<OrderRecord[]> {
    const orders = await this.prisma.forTenant(organizationId).order.findMany({
      where: { organizationId, cartId },
      include: ORDER_WITH_ITEMS,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toOrderRecord);
  }

  async listByOrg(
    organizationId: string,
    filters?: { status?: OrderStatus; page?: number; limit?: number },
  ): Promise<{ items: OrderRecord[]; total: number }> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(filters?.status && { status: filters.status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.forTenant(organizationId).order.findMany({
        where,
        include: ORDER_WITH_ITEMS,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.forTenant(organizationId).order.count({ where }),
    ]);

    return { items: orders.map(toOrderRecord), total };
  }

  async create(input: CreateOrderInput): Promise<OrderRecord> {
    const order = await this.prisma
      .forTenant(input.organizationId)
      .order.create({
        data: {
          organizationId: input.organizationId,
          cartId: input.cartId,
          customerId: input.customerId,
          subtotalCents: input.subtotalCents,
          shippingCents: input.shippingCents,
          status: 'PENDING_PAYMENT',
          totalCents: input.totalCents,
          currency: input.currency,
          shippingAddress: toJsonObject(input.shippingAddress ?? {}),
          // Primer evento del historial: la orden nace en PENDING_PAYMENT.
          statusHistory: { create: { toStatus: 'PENDING_PAYMENT' } },
          items: {
            create: input.items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPriceCentsSnapshot: item.unitPriceCentsSnapshot,
            })),
          },
        },
        include: ORDER_WITH_ITEMS,
      });
    return toOrderRecord(order);
  }

  async updateStatus(
    organizationId: string,
    orderId: string,
    status: OrderStatus,
  ): Promise<OrderRecord> {
    const tenant = this.prisma.forTenant(organizationId);
    const current = await tenant.order.findFirst({
      where: { id: orderId },
      select: { status: true },
    });
    // El cambio y su evento de historial se escriben juntos (una sola sentencia de Prisma = una transacción).
    const order = await tenant.order.update({
      where: { id: orderId },
      data: {
        status,
        statusHistory: {
          create: {
            fromStatus: current?.status ?? null,
            toStatus: status,
          },
        },
      },
      include: ORDER_WITH_ITEMS,
    });
    return toOrderRecord(order);
  }

  async setPaymentIntent(
    organizationId: string,
    orderId: string,
    paymentIntentId: string,
  ): Promise<void> {
    await this.prisma.forTenant(organizationId).order.update({
      where: { id: orderId },
      data: { paymentIntentId },
    });
  }
}
