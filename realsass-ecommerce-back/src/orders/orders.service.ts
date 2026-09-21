// realsass-ecommerce-back/src/orders/orders.service.ts
// ECO-BACK-02: refactorizado para usar IOrdersRepository.
//
// EXCEPCIÓN DOCUMENTADA (ADR-007 / ECO-BACK-02):
// checkout() usa PrismaService directamente para la transacción multi-tabla.
// La atomicidad de (reservar stock + crear orden) no puede abstraerse en el
// repository sin pasar el TransactionClient como parámetro — scope pendiente S5.
// Todo lo demás usa IOrdersRepository.
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService }    from "../prisma/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { ActivityService }  from "../activity/activity.service.js";
import {
  ORDERS_REPOSITORY,
  type IOrdersRepository,
} from "./repository/orders.repository.interface.js";
import {
  assertValidOrderTransition,
  type OrderStatus,
} from "./domain/order.errors.js";
import type { Prisma } from "@prisma/client";

@Injectable()
export class OrdersService {
  constructor(
    // Excepción documentada: $transaction multi-tabla en checkout()
    private readonly prisma:   PrismaService,
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: IOrdersRepository,
    private readonly inventory: InventoryService,
    private readonly activity:  ActivityService,
  ) {}

  // ── Lecturas — todas via repository ───────────────────────────────────────

  async findById(organizationId: string, orderId: string) {
    const order = await this.ordersRepository.findById(organizationId, orderId);
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);
    return order;
  }

  async listBySession(organizationId: string, sessionId: string) {
    return this.ordersRepository.findBySession(organizationId, sessionId);
  }

  async listByOrg(
    organizationId: string,
    filters?: { status?: OrderStatus; page?: number; limit?: number },
  ) {
    return this.ordersRepository.listByOrg(organizationId, filters);
  }

  // ── Checkout — $transaction Prisma directo (excepción documentada) ─────────
  // La atomicidad entre reserveWithinTransaction + create no puede ir al
  // IOrdersRepository sin Prisma.TransactionClient en el contrato — S5.

  async checkout(input: {
    organizationId:  string;
    sessionId:       string;
    cartId:          string;
    customerId:      string;
    shippingAddress: Record<string, unknown>;
    shippingCents?:  number;
  }) {
    const { organizationId, sessionId, cartId, customerId, shippingAddress, shippingCents = 0 } = input;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Leer carrito con items
      const cart = await tx.cart.findFirst({
        where:   { id: cartId, organizationId, status: "ACTIVE" },
        include: {
          items: {
            include: {
              variant: {
                include: { inventory: true },
              },
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException("Carrito vacío o no encontrado");
      }

      // 2. Reservar stock para cada variante
      for (const item of cart.items) {
        await this.inventory.reserveWithinTransaction(
          tx,
          item.variantId,
          item.variant.sku,
          item.quantity,
        );
      }

      // 3. Calcular total
      const itemsTotal = cart.items.reduce(
        (acc, i) => acc + i.variant.priceCents * i.quantity,
        0,
      );
      const total = itemsTotal + shippingCents;

      // 4. Crear orden con items
      const order = await tx.order.create({
        data: {
          organizationId,
          sessionId,
          customerId,
          status:          "PENDING_PAYMENT",
          totalCents:      total,
          currency:        cart.items[0]?.variant.currency ?? "ARS",
          shippingAddress: shippingAddress as Prisma.InputJsonValue,
          items: {
            create: cart.items.map(i => ({
              variantId:  i.variantId,
              quantity:   i.quantity,
              priceCents: i.variant.priceCents,
              currency:   i.variant.currency,
            })),
          },
        },
        include: { items: true },
      });

      // 5. Marcar carrito como COMPLETED
      await tx.cart.update({
        where: { id: cartId },
        data:  { status: "COMPLETED" },
      });

      return order;
    });
  }

  // ── Estado — via repository ────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Excepción ADR-007 / ECO-BACK-02
// OrdersService inyecta PrismaService para checkout() ($transaction multi-tabla).
// SCOPE S5: cuando IOrdersRepository reciba tx?: Prisma.TransactionClient,
// checkout() migrará completamente al repository.
// Ref: collaborators.service.ts tiene la misma excepción documentada.
// ─────────────────────────────────────────────────────────────────────────────
