// realsass-ecommerce-back/src/cart/cart.service.ts
// ECO-BACK-01: refactorizado para usar ICartRepository via @Inject(CART_REPOSITORY).
// PrismaService eliminado — toda la persistencia va por el repository.
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ActivityService }   from "../activity/activity.service.js";
import {
  CART_REPOSITORY,
  type ICartRepository,
} from "./repository/cart.repository.interface.js";
import {
  CartNotFoundError,
  CartItemNotFoundError,
  InsufficientStockForCartError,
  assertValidQuantity,
} from "./domain/cart.errors.js";

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
    cartId:          string,
    variantId:       string,
    quantity:        number,
  ) {
    try {
      assertValidQuantity(quantity);
    } catch (err) {
      throw new UnprocessableEntityException(err instanceof Error ? err.message : String(err));
    }

    const cart = await this.cartRepository.findById(organizationId, cartId);
    if (!cart) throw new NotFoundException(`Carrito ${cartId} no encontrado`);

    // Verificar stock disponible en el ítem de la variante
    const inventoryItem = cart.items
      .find(i => i.variantId === variantId)
      ?.variant.inventory;

    if (inventoryItem) {
      const available = inventoryItem.quantityAvailable - inventoryItem.quantityReserved;
      const currentQty = cart.items.find(i => i.variantId === variantId)?.quantity ?? 0;
      if (currentQty + quantity > available) {
        throw new UnprocessableEntityException(
          new InsufficientStockForCartError(variantId, quantity, available).message,
        );
      }
    }

    return this.cartRepository.upsertItem(cartId, variantId, quantity);
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
