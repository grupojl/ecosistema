// realsass-ecommerce-back/src/cart/cart.service.ts
// ECO-BACK-01: refactorizado para usar ICartRepository via @Inject(CART_REPOSITORY).
// PrismaService eliminado — toda la persistencia va por el repository.
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ActivityService }   from "@/activity/activity.service";
import {
  CART_REPOSITORY,
  type ICartRepository,
} from "@/cart/repository/cart.repository.interface";
import {
  CartNotFoundError,
  CartItemNotFoundError,
  InsufficientStockForCartError,
  assertValidQuantity,
} from "@/cart/domain/cart.errors";

@Injectable()
export class CartService {
  constructor(
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: ICartRepository,
    private readonly activity:        ActivityService,
  ) {}

  async getOrCreateCart(organizationId: string, sessionId: string, customerId?: string) {
    const existing = await this.cartRepository.findActiveBySession(organizationId, sessionId);
    if (existing && (!customerId || !existing.customerId || existing.customerId === customerId)) return existing;
    return this.cartRepository.create(organizationId, sessionId, customerId);
  }

  /**
   * Un carrito con dueño solo lo ve su dueño. Se responde "no encontrado" (no "prohibido") para no revelar que existe.
   * Antes bastaba conocer el UUID de un carrito para leerlo, modificarlo o pagarlo.
   */
  private assertOwner(cart: { id: string; customerId: string | null }, customerId?: string): void {
    if (customerId && cart.customerId && cart.customerId !== customerId) {
      throw new NotFoundException(`Carrito ${cart.id} no encontrado`);
    }
  }

  async getCart(organizationId: string, cartId: string, customerId?: string) {
    const cart = await this.cartRepository.findById(organizationId, cartId);
    if (!cart) throw new NotFoundException(`Carrito ${cartId} no encontrado`);
    this.assertOwner(cart, customerId);
    return cart;
  }

  async addItem(
    organizationId: string,
    sessionId:       string,
    variantId:       string,
    quantity:        number,
    cartId?:         string,
    customerId?:     string,
  ) {
    try {
      assertValidQuantity(quantity);
    } catch (err) {
      throw new UnprocessableEntityException(err instanceof Error ? err.message : String(err));
    }

    let resolvedCartId: string;
    if (cartId) {
      // Antes se usaba el cartId sin comprobar que existiera ni de quién era (ni de qué organización).
      const cart = await this.getCart(organizationId, cartId, customerId);
      if (customerId && !cart.customerId) await this.cartRepository.assignCustomer(cart.id, customerId);
      resolvedCartId = cart.id;
    } else {
      resolvedCartId = (await this.getOrCreateCart(organizationId, sessionId, customerId)).id;
    }
    return this.cartRepository.upsertItem(resolvedCartId, variantId, quantity);
  }

  async removeItem(
    organizationId: string,
    cartId:          string,
    variantId:       string,
    customerId?:     string,
  ) {
    const cart = await this.getCart(organizationId, cartId, customerId);

    const exists = cart.items.some(i => i.variantId === variantId);
    if (!exists) {
      throw new NotFoundException(new CartItemNotFoundError(variantId).message);
    }

    return this.cartRepository.removeItem(cartId, variantId);
  }

  async completeCart(organizationId: string, cartId: string): Promise<void> {
    const cart = await this.cartRepository.findById(organizationId, cartId);
    if (!cart) throw new NotFoundException(new CartNotFoundError(cartId).message);
    await this.cartRepository.complete(cartId);
  }
}
