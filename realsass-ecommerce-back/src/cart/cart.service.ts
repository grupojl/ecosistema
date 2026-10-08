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

  async getOrCreateCart(organizationId: string, sessionId: string) {
    const existing = await this.cartRepository.findActiveBySession(organizationId, sessionId);
    if (existing) return existing;
    return this.cartRepository.create(organizationId, sessionId);
  }

  async getCart(organizationId: string, cartId: string) {
    const cart = await this.cartRepository.findById(organizationId, cartId);
    if (!cart) throw new NotFoundException(`Carrito ${cartId} no encontrado`);
    return cart;
  }

  async addItem(
    organizationId: string,
    sessionId:       string,
    variantId:       string,
    quantity:        number,
    cartId?:         string,
  ) {
    try {
      assertValidQuantity(quantity);
    } catch (err) {
      throw new UnprocessableEntityException(err instanceof Error ? err.message : String(err));
    }
    const resolvedCartId = cartId
      ?? (await this.cartRepository.findActiveBySession(organizationId, sessionId))?.id
      ?? (await this.cartRepository.create(organizationId, sessionId)).id;
    return this.cartRepository.upsertItem(resolvedCartId, variantId, quantity);
  }

  async removeItem(
    organizationId: string,
    cartId:          string,
    variantId:       string,
  ) {
    const cart = await this.cartRepository.findById(organizationId, cartId);
    if (!cart) throw new NotFoundException(`Carrito ${cartId} no encontrado`);

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
