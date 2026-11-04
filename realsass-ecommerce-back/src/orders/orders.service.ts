// realsass-ecommerce-back/src/orders/orders.service.ts
import { toJsonObject } from '@/common/prisma/json';
import { OrganizationsClientService } from '@/organizations-client/organizations-client.service';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  type PrismaTransactionClient,
} from '@/prisma/prisma.service';
import { toTransactionClient } from '@/prisma/prisma.service';
import { runAsTenant, setSystemContext } from '@/prisma/tenant-context';
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

    return runAsTenant(this.prisma, organizationId, async (tx) => {
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
          shippingAddress: toJsonObject(shippingAddress),
          locale: input.locale ?? null,
          // Snapshot del Market (ADR-014): inmutable. Si el dueño cambia la config del Market después, esta orden no cambia.
          // 'default' es el fallback cuando sass-back no responde: no es un Market real, no se referencia.
          marketId: market.id === 'default' ? null : market.id,
          visitorCountryCode: visitorCountry,
          fulfillmentSnapshot:
            toJsonObject({ ...market.fulfillmentConfig }),
          statusHistory: { create: { toStatus: 'PENDING_PAYMENT' } },
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

    if (to === 'CANCELLED' || to === 'PAID') {
      return this.settlePending(organizationId, orderId, to);
    }

    return this.ordersRepository.updateStatus(organizationId, orderId, to);
  }

  /**
   * Salida de PENDING_PAYMENT con su efecto sobre el stock, en la MISMA transacción que el cambio de estado
   * (DT-ORDER-STOCK):
   *   · CANCELLED → devuelve lo reservado a lo vendible;
   *   · PAID      → lo reservado pasa a vendido (baja `reserved`; `available` ya estaba descontado).
   * El UPDATE condicional (status = PENDING_PAYMENT) hace que un pago y una cancelación/vencimiento simultáneos no
   * puedan ganar los dos: el que pierde ve 0 filas, recibe Conflict y no toca el stock.
   */
  private async settlePending(
    organizationId: string,
    orderId: string,
    to: 'CANCELLED' | 'PAID',
    reason?: string,
  ) {
    await runAsTenant(this.prisma, organizationId, async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: orderId, organizationId, status: 'PENDING_PAYMENT' },
        data: { status: to },
      });
      if (moved.count === 0) {
        throw new ConflictException(
          'La orden cambió de estado mientras se actualizaba; recargá e intentá de nuevo',
        );
      }
      await tx.orderStatusEvent.create({
        data: {
          orderId,
          fromStatus: 'PENDING_PAYMENT',
          toStatus: to,
          reason: reason ?? null,
        },
      });
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        if (to === 'CANCELLED') {
          await this.inventory.releaseWithinTransaction(tx, item.variantId, item.quantity);
        } else {
          await this.inventory.commitWithinTransaction(tx, item.variantId, item.quantity);
        }
      }
    });
    const updated = await this.ordersRepository.findById(organizationId, orderId);
    if (!updated) throw new NotFoundException(`Orden ${orderId} no encontrada`);
    return updated;
  }

  /**
   * Vencimiento de pago: cancela las órdenes PENDING_PAYMENT creadas antes de `cutoff` y libera su stock.
   * Corre como trabajo de sistema (ve todos los tenants solo para ELEGIR candidatas; cada cancelación es por tenant).
   * Seguro con varias instancias y frente a un pago concurrente (ver settlePending). Devuelve cuántas canceló.
   */
  async expireUnpaid(cutoff: Date, limit = 50): Promise<number> {
    const candidates = await this.prisma.$transaction(async (raw) => {
      const tx = toTransactionClient(raw);
      await setSystemContext(tx);
      return tx.order.findMany({
        where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
        select: { id: true, organizationId: true },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
    });
    let expired = 0;
    for (const c of candidates) {
      try {
        await this.settlePending(c.organizationId, c.id, 'CANCELLED', 'Vencido: sin pago a tiempo');
        expired++;
      } catch (err) {
        if (!(err instanceof ConflictException)) throw err; // se pagó/canceló justo antes: nada que hacer
      }
    }
    return expired;
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
