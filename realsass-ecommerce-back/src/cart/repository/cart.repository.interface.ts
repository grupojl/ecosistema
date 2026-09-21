/**
 * repository/cart.repository.interface.ts — realsass-ecommerce-back
 *
 * Puerto (interface) de la capa Repository para el bounded context "cart".
 * CartService depende SOLO de esta interfaz — nunca de PrismaService directamente.
 *
 * Token de inyección: CART_REPOSITORY (ver cart.module.ts)
 */

export const CART_REPOSITORY = Symbol("CART_REPOSITORY");

export interface CartItemRecord {
  id:        string;
  cartId:    string;
  variantId: string;
  quantity:  number;
  variant: {
    id:         string;
    sku:        string;
    title:      string;
    priceCents: number;
    currency:   string;
    product: {
      id:   string;
      name: string;
    };
    inventory: {
      quantityAvailable: number;
      quantityReserved:  number;
    } | null;
  };
}

export interface CartRecord {
  id:             string;
  organizationId: string;
  sessionId:      string;
  status:         "ACTIVE" | "COMPLETED" | "ABANDONED";
  createdAt:      Date;
  updatedAt:      Date;
  items:          CartItemRecord[];
}

export interface ICartRepository {
  /**
   * Busca el carrito activo de una sesión. Retorna null si no existe.
   */
  findActiveBySession(
    organizationId: string,
    sessionId:      string,
  ): Promise<CartRecord | null>;

  /**
   * Busca un carrito por id, con validación de organización.
   */
  findById(
    organizationId: string,
    cartId:         string,
  ): Promise<CartRecord | null>;

  /**
   * Crea un carrito vacío para una sesión.
   */
  create(
    organizationId: string,
    sessionId:      string,
  ): Promise<CartRecord>;

  /**
   * Agrega o incrementa un ítem en el carrito.
   * Si ya existe la variante, suma la cantidad.
   */
  upsertItem(
    cartId:    string,
    variantId: string,
    quantity:  number,
  ): Promise<CartRecord>;

  /**
   * Elimina un ítem del carrito por variantId.
   */
  removeItem(
    cartId:    string,
    variantId: string,
  ): Promise<CartRecord>;

  /**
   * Marca el carrito como COMPLETED (checkout exitoso).
   */
  complete(cartId: string): Promise<void>;
}
