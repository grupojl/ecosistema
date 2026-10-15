// realsass-ecommerce-back/src/orders/orders.service.ts
import { OrganizationsClientService }           from '@/organizations-client/organizations-client.service';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService, type PrismaTransactionClient } from "@/prisma/prisma.service";
import { InventoryService }  from "@/inventory/inventory.service";
import { ActivityService }   from "@/activity/activity.service";
import {
  ORDERS_REPOSITORY,
  type IOrdersRepository,
} from "@/orders/repository/orders.repository.interface";
import {
  assertValidOrderTransition,
  type OrderStatus,
} from "@/orders/domain/order.errors";
import type { Prisma } from "@/generated/prisma";

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma:           PrismaService,
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: IOrdersRepository,
    private readonly inventory:        InventoryService,
    private readonly activity:         ActivityService,
    private readonly orgsClient:       OrganizationsClientService,
  ) {}

  // ── Lecturas ───────────────────────────────────────────────────────────────

  async findById(organizationId: string, orderId: string) {
    const order = await this.ordersRepository.findById(organizationId, orderId);
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);
    return order;
  }

  async listOrders(organizationId: string, sessionId?: string) {
    if (sessionId) return this.ordersRepository.findByCart(organizationId, sessionId);
    return this.ordersRepository.findByCart(organizationId, '');
  }

  async getOrder(organizationId: string, orderId: string) {
    return this.ordersRepository.findById(organizationId, orderId);
  }

  async listBySession(organizationId: string, sessionId: string) {
    return this.ordersRepository.findByCart(organizationId, sessionId);
  }

  async checkout(input: {
    organizationId:      string;
    sessionId?:          string;
    cartId:              string;
    customerId:          string;
    shippingAddress:     Record<string, unknown>;
    visitorCountryCode?: string;
    locale?:             string;
  }) {
    const {
      organizationId, cartId, customerId,
      shippingAddress,
    } = input;

    // ADR-014: se resuelve ANTES de la transacción (HTTP + cache Redis) para no abrir la tx con una llamada de red.
    // El resultado se guarda en la orden (snapshot): si el dueño cambia después el Market, la orden conserva el
    // fulfillment con el que se vendió.
    const market = await this.orgsClient.resolveMarket(
      organizationId,
      input.visitorCountryCode ?? 'default',
    );

    // El envío sale del Market resuelto por el servidor; el cliente no lo puede fijar (DT-Q-14).
    const rate = market.fulfillmentConfig['shippingCents'];
    const shippingCents = typeof rate === 'number' && Number.isInteger(rate) && rate >= 0 ? rate : 0;

    return this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      // Idempotencia: el carrito se RECLAMA con un UPDATE atómico (ACTIVE -> CONVERTED). Dos checkouts simultáneos del
      // mismo carrito (doble clic, reintento tras un timeout) se serializan en el bloqueo de la fila: el segundo ve el
      // carrito ya convertido, no reserva stock y recibe la MISMA orden del primero. Antes ambos reservaban stock y
      // recién el INSERT de la orden chocaba con la restricción única de cartId (un error de base sin traducir).
      const claimed = await tx.cart.updateMany({
        where: { id: cartId, organizationId, status: 'ACTIVE' },
        data:  { status: 'CONVERTED' },
      });
      if (claimed.count === 0) {
        // customerId en el filtro: nadie recupera la orden de un carrito ajeno.
        const existing = await tx.order.findFirst({
          where:   { cartId, organizationId, customerId },
          include: { items: true },
        });
        if (existing) return existing;
        throw new BadRequestException('Carrito vacío o no encontrado');
      }

      const cart = await tx.cart.findFirst({
        where:   { id: cartId, organizationId },
        include: {
          items: {
            include: { variant: { include: { inventory: true } } },
          },
        },
      });

      // Si falla algo de acá en adelante la transacción entera se revierte, incluido el reclamo del carrito.
      if (!cart || cart.items.length === 0) {
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
          // subtotal = solo los ítems; subtotal + envío = total (antes el subtotal guardaba el total con envío
          // y el envío no se persistía, así que la orden no cerraba).
          subtotalCents:   itemsTotal,
          shippingCents,
          status:          'PENDING_PAYMENT',
          totalCents:      total,
          currency:        cart.items[0]?.variant.currency ?? 'ARS',
          shippingAddress: shippingAddress as Prisma.InputJsonValue,
          locale:          input.locale ?? null,
          // ADR-014: 'default' es el fallback cuando sass-back no responde (no es un Market real => sin marketId).
          marketId:            market.id === 'default' ? null : market.id,
          visitorCountryCode:  input.visitorCountryCode?.toUpperCase() ?? null,
          fulfillmentSnapshot: market.fulfillmentConfig as Prisma.InputJsonValue,
          items: {
            create: cart.items.map(i => ({
              variantId:              i.variantId,
              quantity:               i.quantity,
              unitPriceCentsSnapshot: i.variant.priceCents,
            })),
          },
        },
        include: { items: true },
      });

      return order;
    });
  }

  // ── Estado ─────────────────────────────────────────────────────────────────

  async updateStatus(
    organizationId: string,
    orderId:        string,
    to:             OrderStatus,
  ) {
    const order = await this.ordersRepository.findById(organizationId, orderId);
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);

    try {
      assertValidOrderTransition(order.status, to);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : String(err));
    }

    return this.ordersRepository.updateStatus(orderId, to);
  }

  async setPaymentIntent(
    organizationId:  string,
    orderId:         string,
    paymentIntentId: string,
  ) {
    const order = await this.ordersRepository.findById(organizationId, orderId);
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);
    await this.ordersRepository.setPaymentIntent(orderId, paymentIntentId);
  }
}
