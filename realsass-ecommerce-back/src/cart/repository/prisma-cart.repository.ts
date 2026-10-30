/**
 * repository/prisma-cart.repository.ts — realsass-ecommerce-back
 *
 * Adaptador concreto de ICartRepository usando Prisma.
 * ÚNICO archivo del módulo cart que puede importar PrismaService.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  ICartRepository,
  CartRecord,
} from '@/cart/repository/cart.repository.interface';

const CART_WITH_ITEMS = {
  items: {
    include: {
      variant: {
        include: {
          product: { select: { id: true, name: true } },
          inventory: {
            select: { quantityAvailable: true, quantityReserved: true },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class PrismaCartRepository implements ICartRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * CartItem no tiene organizationId: se alcanza por su carrito. Antes de tocar ítems se comprueba (con el cliente de tenant)
   * que el carrito sea de la organización; si no, es como si no existiera.
   */
  private async assertCartInOrg(
    organizationId: string,
    cartId: string,
  ): Promise<void> {
    const cart = await this.prisma
      .forTenant(organizationId)
      .cart.findFirst({ where: { id: cartId }, select: { id: true } });
    if (!cart) throw new NotFoundException('Carrito no encontrado');
  }

  async findActiveBySession(
    organizationId: string,
    sessionId: string,
  ): Promise<CartRecord | null> {
    const cart = await this.prisma.forTenant(organizationId).cart.findFirst({
      where: { organizationId, sessionId, status: 'ACTIVE' },
      include: CART_WITH_ITEMS,
    });
    return cart;
  }

  async findById(
    organizationId: string,
    cartId: string,
  ): Promise<CartRecord | null> {
    const cart = await this.prisma.forTenant(organizationId).cart.findFirst({
      where: { id: cartId, organizationId },
      include: CART_WITH_ITEMS,
    });
    return cart;
  }

  async assignCustomer(
    organizationId: string,
    cartId: string,
    customerId: string,
  ): Promise<void> {
    await this.prisma
      .forTenant(organizationId)
      .cart.update({ where: { id: cartId }, data: { customerId } });
  }

  async create(
    organizationId: string,
    sessionId: string,
    customerId?: string,
  ): Promise<CartRecord> {
    const cart = await this.prisma.forTenant(organizationId).cart.create({
      data: {
        organizationId,
        sessionId,
        status: 'ACTIVE',
        ...(customerId ? { customerId } : {}),
      },
      include: CART_WITH_ITEMS,
    });
    return cart;
  }

  async upsertItem(
    organizationId: string,
    cartId: string,
    variantId: string,
    quantity: number,
    unitPriceCentsSnapshot = 0,
  ): Promise<CartRecord> {
    await this.assertCartInOrg(organizationId, cartId);
    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId, variantId },
    });

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId, variantId, quantity, unitPriceCentsSnapshot },
      });
    }

    const cart = await this.prisma
      .forTenant(organizationId)
      .cart.findUniqueOrThrow({
        where: { id: cartId },
        include: CART_WITH_ITEMS,
      });
    return cart;
  }

  async removeItem(
    organizationId: string,
    cartId: string,
    variantId: string,
  ): Promise<CartRecord> {
    await this.assertCartInOrg(organizationId, cartId);
    const item = await this.prisma.cartItem.findFirst({
      where: { cartId, variantId },
    });
    if (!item) throw new NotFoundException('Ítem no encontrado en el carrito');

    await this.prisma.cartItem.delete({ where: { id: item.id } });

    const cart = await this.prisma
      .forTenant(organizationId)
      .cart.findUniqueOrThrow({
        where: { id: cartId },
        include: CART_WITH_ITEMS,
      });
    return cart;
  }

  async complete(organizationId: string, cartId: string): Promise<void> {
    await this.prisma.forTenant(organizationId).cart.update({
      where: { id: cartId },
      data: { status: 'CONVERTED' },
    });
  }
}
