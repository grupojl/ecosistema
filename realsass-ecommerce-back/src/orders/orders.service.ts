// realsass-ecommerce-back/src/orders/orders.service.ts
import { OrganizationsClientService } from '@/organizations-client/organizations-client.service';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  type PrismaTransactionClient,
} from '@/prisma/prisma.service';
import { InventoryService } from '@/inventory/inventory.service';
import { ActivityService } from '@/activity/activity.service';
import {
  ORDERS_REPOSITORY,
  type IOrdersRepository,
} from '@/orders/repository/orders.repository.interface';
import {
  assertValidOrderTransition,
  type OrderStatus,
} from '@/orders/domain/order.errors';
import type { Prisma } from '@/generated/prisma';
import { OutboxService } from '@/outbox/outbox.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: IOrdersRepository,
    private readonly inventory: InventoryService,
    private readonly activity: ActivityService,
    private readonly orgsClient: OrganizationsClientService,
    private readonly outbox: OutboxService,
  ) {}

  // ── Lecturas ───────────────────────────────────────────────────────────────

  async findById(organizationId: string, orderId: string) {
    const order = await this.ordersRepository.findById(organizationId, orderId);
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);
    return order;
  }

  async listOrders(organizationId: string, sessionId?: string) {
    if (sessionId)
      return this.ordersRepository.findByCart(organizationId, sessionId);
    return this.ordersRepository.findByCart(organizationId, '');
  }

  /** Historial del cliente. (listOrders sin sesión buscaba cartId '' y devolvía siempre vacío.) */
  async listByCustomer(organizationId: string, customerId: string) {
    return this.ordersRepository.findByCustomer(organizationId, customerId);
  }

  async getOrder(organizationId: string, orderId: string) {
    return this.ordersRepository.findById(organizationId, orderId);
  }

  async listBySession(organizationId: string, sessionId: string) {
    return this.ordersRepository.findByCart(organizationId, sessionId);
  }

  async checkout(input: {
    organizationId: string;
    sessionId?: string;
    cartId: string;
    customerId: string;
    shippingAddress: Record<string, unknown>;
    shippingCents?: number;
    visitorCountryCode?: string;
    locale?: string;
  }) {
    const {
      organizationId,
      cartId,
      customerId,
      shippingAddress,
      shippingCents = 0,
    } = input;

    // Resolver market ANTES de la transacción (HTTP + Redis cache — ADR-014)
    const visitorCountry =
      input.visitorCountryCode && input.visitorCountryCode !== 'default'
        ? input.visitorCountryCode.toUpperCase()
        : null;
    const market = await this.orgsClient.resolveMarket(
      organizationId,
      visitorCountry ?? 'default',
    );

    return this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      // Idempotencia (ADR-029): se bloquea la fila del carrito hasta el final de la transacción. Dos checkouts
      // simultáneos (doble clic, reintento de red) se serializan: el segundo espera y, al ver el carrito ya
      // CONVERTED, devuelve la orden ya creada en vez de fallar por Order.cartId UNIQUE (que además revertía su reserva).
      // Filtra por organización y dueño: el bloqueo no se puede usar para tocar carritos ajenos.
      await tx.$queryRaw`
        SELECT id FROM carts
        WHERE  id = ${cartId} AND organization_id = ${organizationId} AND customer_id = ${customerId}
        FOR UPDATE
      `;

      const cart = await tx.cart.findFirst({
        where: { id: cartId, organizationId, customerId }, // solo el dueño paga SU carrito
        include: {
          items: {
            include: { variant: { include: { inventory: true } } },
          },
        },
      });

      if (cart?.status === 'CONVERTED') {
        const existing = await tx.order.findFirst({
          where: { cartId, organizationId, customerId },
          include: { items: true },
        });
        if (existing) return existing; // reintento del mismo checkout: misma orden, sin reservar stock otra vez
      }

      if (!cart || cart.status !== 'ACTIVE' || cart.items.length === 0) {
        throw new BadRequestException('Carrito vacío o no encontrado');
      }

      for (const item of cart.items) {
        await this.inventory.reserveWithinTransaction(
          tx,
          item.variantId,
          item.variant.sku,
          item.quantity,
        );
      }

      const itemsTotal = cart.items.reduce(
        (acc, i) => acc + i.variant.priceCents * i.quantity,
        0,
      );
      const total = itemsTotal + shippingCents;

      const order = await tx.order.create({
        data: {
          organizationId,
          customerId,
          cartId,
          subtotalCents: itemsTotal,
          status: 'PENDING_PAYMENT',
          totalCents: total,
          currency: cart.items[0]?.variant.currency ?? 'ARS',
          shippingAddress: shippingAddress as Prisma.InputJsonValue,
          locale: input.locale ?? null,
          // Snapshot del Market (ADR-014): inmutable. Si el dueño cambia la config del Market después, esta orden no cambia.
          // 'default' es el fallback cuando sass-back no responde: no es un Market real, no se referencia.
          marketId: market.id === 'default' ? null : market.id,
          visitorCountryCode: visitorCountry,
          fulfillmentSnapshot:
            market.fulfillmentConfig as Prisma.InputJsonValue,
          items: {
            create: cart.items.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
              unitPriceCentsSnapshot: i.variant.priceCents,
            })),
          },
        },
        include: { items: true },
      });

      await tx.cart.update({
        where: { id: cartId },
        data: { status: 'CONVERTED' },
      });

      // Outbox (ADR-029): el evento nace en la MISMA transacción que la orden; si ésta se revierte, el evento no existe.
      // Sin datos personales: el consumidor consulta la orden por id.
      if (this.outbox.enabled) {
        await this.outbox.enqueue(tx, {
          organizationId,
          aggregateType: 'Order',
          aggregateId: order.id,
          type: 'order.created',
          payload: {
            orderId: order.id,
            customerId,
            totalCents: total,
            currency: order.currency,
            marketId: order.marketId ?? null,
            visitorCountryCode: order.visitorCountryCode ?? null,
            itemCount: order.items.length,
          },
        });
      }

      return order;
    });
  }

  // ── Estado ─────────────────────────────────────────────────────────────────

  async updateStatus(organizationId: string, orderId: string, to: OrderStatus) {
    const order = await this.ordersRepository.findById(organizationId, orderId);
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);

    try {
      assertValidOrderTransition(order.status, to);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : String(err),
      );
    }

    return this.ordersRepository.updateStatus(organizationId, orderId, to);
  }

  async setPaymentIntent(
    organizationId: string,
    orderId: string,
    paymentIntentId: string,
  ) {
    const order = await this.ordersRepository.findById(organizationId, orderId);
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);
    await this.ordersRepository.setPaymentIntent(
      organizationId,
      orderId,
      paymentIntentId,
    );
  }
}
