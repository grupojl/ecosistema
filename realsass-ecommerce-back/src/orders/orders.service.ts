import { OrganizationsClientService } from '../organizations-client/organizations-client.service';
import { resolveVisitorCountry }      from './lib/resolve-visitor-country';
// realsass-ecommerce-back/src/orders/orders.service.ts
// ECO-BACK-02: refactorizado para usar IOrdersRepository.
//
// EXCEPCIÓN DOCUMENTADA (ADR-007 / ECO-BACK-02):
// checkout() usa PrismaService directamente para la transacción multi-tabla.
// La atomicidad de (reservar stock + crear orden) no puede abstraerse en el
// repository sin pasar el TransactionClient como parámetro — scope pendiente S5.
// Todo lo demás usa IOrdersRepository.
//
// NOTA — alcance de este cambio (ADR-016, sesión de idioma de la orden):
// Se agrega SOLO `locale` para que el invoice/email de confirmación salga en
// el idioma de la sesión del comprador. `market` (línea de abajo) sigue
// siendo una variable sin resolver — bug preexistente, documentado y
// pendiente en ADR-014-markets-status.md, fuera de este alcance a pedido
// explícito: se resuelve en hardening. checkout() NO va a ejecutar hasta que
// ese fix se aplique — este cambio deja el campo listo para cuando eso pase,
// no lo hace funcional por sí solo.
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
    private readonly orgsClient: OrganizationsClientService,
  ) {}

  // ── Lecturas — todas via repository ───────────────────────────────────────

  async findById(organizationId: string, orderId: string) {
    const order = await this.ordersRepository.findById(organizationId, orderId);
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);
    return order;
  }

  async listBySession(organizationId: string, sessionId: string) {
    return this.ordersRepository.listBySession(organizationId, sessionId);
  }

  async checkout(input: {
    organizationId:  string;
    sessionId:       string;
    cartId:          string;
    customerId:      string;
    shippingAddress: Record<string, unknown>;
    shippingCents?:  number;
    visitorCountryCode?: string; // ISO 3166-1 alpha-2 — ADR-014
    locale?:         string;    // idioma de la sesión del comprador — ADR-016, para el invoice
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
          marketId:             market.id,
          visitorCountryCode:   input.visitorCountryCode ?? null,
          locale:               input.locale ?? null,
          fulfillmentSnapshot:  market.fulfillmentConfig as Prisma.InputJsonValue,
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
