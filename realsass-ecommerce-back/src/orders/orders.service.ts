import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService }    from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ActivityService }  from '../activity/activity.service';
import type { Prisma }      from '@prisma/client';
import type { OrderOutput } from './types/order.types';

interface CheckoutInput {
  cartId:          string;
  customerId:      string;
  shippingAddress: Record<string, unknown>;
  shippingCents?:  number;
}

/** Mapper Prisma → OrderOutput — sin as any */
function toOrderOutput(
  row: Prisma.OrderGetPayload<{
    include: {
      items:         true;
      statusHistory: true;
    };
  }>,
): OrderOutput {
  return {
    id:              row.id,
    organizationId:  row.organizationId,
    customerId:      row.customerId,
    cartId:          row.cartId,
    status:          row.status,
    totalCents:      row.totalCents,
    shippingCents:   row.shippingCents,
    paymentIntentId: row.paymentIntentId,
    // @real/jsonb-cast — shippingAddress es campo Json en Prisma
    shippingAddress: row.shippingAddress as Record<string, unknown>,
    createdAt:       row.createdAt,
    updatedAt:       row.updatedAt,
    items: row.items.map(i => ({
      id:                     i.id,
      variantId:              i.variantId,
      quantity:               i.quantity,
      unitPriceCentsSnapshot: i.unitPriceCentsSnapshot,
    })),
    statusHistory: row.statusHistory.map(e => ({
      id:         e.id,
      fromStatus: e.fromStatus,
      toStatus:   e.toStatus,
      reason:     e.reason,
      createdAt:  e.createdAt,
    })),
  };
}

/** Mapper para listado (sin items ni statusHistory) */
function toOrderSummary(
  row: Prisma.OrderGetPayload<Record<string, never>>,
): Omit<OrderOutput, 'items' | 'statusHistory'> {
  return {
    id:              row.id,
    organizationId:  row.organizationId,
    customerId:      row.customerId,
    cartId:          row.cartId,
    status:          row.status,
    totalCents:      row.totalCents,
    shippingCents:   row.shippingCents,
    paymentIntentId: row.paymentIntentId,
    // @real/jsonb-cast
    shippingAddress: row.shippingAddress as Record<string, unknown>,
    createdAt:       row.createdAt,
    updatedAt:       row.updatedAt,
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma:     PrismaService,
    private readonly inventory:  InventoryService,
    private readonly activity:   ActivityService,
  ) {}

  /**
   * Convierte un carrito ACTIVE en una orden PENDING_PAYMENT.
   * Reserva de stock y creación de orden van en UNA transacción.
   * TODO: cuando se conecte pasarela-pagos, acá se crea el PaymentIntent.
   */
  async checkout(organizationId: string, dto: CheckoutInput): Promise<OrderOutput> {
    const cart = await this.prisma.cart.findFirst({
      where:   { id: dto.cartId, organizationId, status: 'ACTIVE' },
      include: { items: { include: { variant: true } } },
    });

    if (!cart) throw new NotFoundException('Cart not found or not active');
    if (!cart.items.length) throw new BadRequestException('Cart is empty');

    const totalCents = cart.items.reduce(
      (sum, i) => sum + i.variant.priceCents * i.quantity, 0,
    );

    const order = await this.prisma.$transaction(async (tx) => {
      // Reservar stock atómicamente para cada ítem
      for (const item of cart.items) {
        await this.inventory.reserveWithinTransaction(
          tx, organizationId, item.variantId, item.quantity,
        );
      }

      // Crear la orden
      const created = await tx.order.create({
        data: {
          organizationId,
          customerId:      dto.customerId,
          cartId:          dto.cartId,
          status:          'PENDING_PAYMENT',
          totalCents,
          shippingCents:   dto.shippingCents ?? 0,
          shippingAddress: dto.shippingAddress,
          items: {
            create: cart.items.map(i => ({
              variantId:              i.variantId,
              quantity:               i.quantity,
              unitPriceCentsSnapshot: i.variant.priceCents,
            })),
          },
          statusHistory: {
            create: { toStatus: 'PENDING_PAYMENT' },
          },
        },
        include: { items: true, statusHistory: true },
      });

      // Marcar carrito como completado
      await tx.cart.update({ where: { id: dto.cartId }, data: { status: 'COMPLETED' } });

      return created;
    });

    await this.activity.log(organizationId, dto.cartId, 'checkout_completed', dto.customerId);

    return toOrderOutput(order);
  }

  async listOrders(organizationId: string): Promise<Omit<OrderOutput, 'items' | 'statusHistory'>[]> {
    const rows = await this.prisma.order.findMany({
      where:   { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toOrderSummary);
  }

  async getOrder(organizationId: string, orderId: string): Promise<OrderOutput> {
    const row = await this.prisma.order.findFirst({
      where:   { id: orderId, organizationId },
      include: { items: true, statusHistory: true },
    });
    if (!row) throw new NotFoundException(`Order ${orderId} not found`);
    return toOrderOutput(row);
  }
}
