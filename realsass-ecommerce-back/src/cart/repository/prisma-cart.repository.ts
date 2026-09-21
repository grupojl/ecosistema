/**
 * repository/prisma-cart.repository.ts — realsass-ecommerce-back
 *
 * Adaptador concreto de ICartRepository usando Prisma.
 * ÚNICO archivo del módulo cart que puede importar PrismaService.
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { ICartRepository, CartRecord } from "./cart.repository.interface";

const CART_WITH_ITEMS = {
  items: {
    include: {
      variant: {
        include: {
          product:   { select: { id: true, name: true } },
          inventory: { select: { quantityAvailable: true, quantityReserved: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class PrismaCartRepository implements ICartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveBySession(
    organizationId: string,
    sessionId:      string,
  ): Promise<CartRecord | null> {
    const cart = await this.prisma.cart.findFirst({
      where:   { organizationId, sessionId, status: "ACTIVE" },
      include: CART_WITH_ITEMS,
    });
    return cart as CartRecord | null;
  }

  async findById(
    organizationId: string,
    cartId:         string,
  ): Promise<CartRecord | null> {
    const cart = await this.prisma.cart.findFirst({
      where:   { id: cartId, organizationId },
      include: CART_WITH_ITEMS,
    });
    return cart as CartRecord | null;
  }

  async create(
    organizationId: string,
    sessionId:      string,
  ): Promise<CartRecord> {
    const cart = await this.prisma.cart.create({
      data:    { organizationId, sessionId, status: "ACTIVE" },
      include: CART_WITH_ITEMS,
    });
    return cart as CartRecord;
  }

  async upsertItem(
    cartId:    string,
    variantId: string,
    quantity:  number,
  ): Promise<CartRecord> {
    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId, variantId },
    });

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data:  { quantity: existing.quantity + quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId, variantId, quantity },
      });
    }

    const cart = await this.prisma.cart.findUniqueOrThrow({
      where:   { id: cartId },
      include: CART_WITH_ITEMS,
    });
    return cart as CartRecord;
  }

  async removeItem(cartId: string, variantId: string): Promise<CartRecord> {
    const item = await this.prisma.cartItem.findFirst({
      where: { cartId, variantId },
    });
    if (!item) throw new NotFoundException("Ítem no encontrado en el carrito");

    await this.prisma.cartItem.delete({ where: { id: item.id } });

    const cart = await this.prisma.cart.findUniqueOrThrow({
      where:   { id: cartId },
      include: CART_WITH_ITEMS,
    });
    return cart as CartRecord;
  }

  async complete(cartId: string): Promise<void> {
    await this.prisma.cart.update({
      where: { id: cartId },
      data:  { status: "COMPLETED" },
    });
  }
}
