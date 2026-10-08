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
    shippingCents?:      number;
    visitorCountryCode?: string;
    locale?:             string;
  }) {
    const {
      organizationId, cartId, customerId,
      shippingAddress, shippingCents = 0,
    } = input;

    // Resolver market ANTES de la transacción (HTTP + Redis cache — ADR-014)
    const market = await this.orgsClient.resolveMarket(
      organizationId,
      input.visitorCountryCode ?? 'default',
    );

    return this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const cart = await tx.cart.findFirst({
        where:   { id: cartId, organizationId, status: 'ACTIVE' },
        include: {
          items: {
            include: { variant: { include: { inventory: true } } },
          },
        },
      });

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
          subtotalCents:   total,
          status:          'PENDING_PAYMENT',
          totalCents:      total,
          currency:        cart.items[0]?.variant.currency ?? 'ARS',
          shippingAddress: shippingAddress as Prisma.InputJsonValue,
          locale:          input.locale ?? null,
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

      await tx.cart.update({
        where: { id: cartId },
        data:  { status: 'CONVERTED' },
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
      assertValidOrderTransition(order.status as OrderStatus, to);
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
