/**
 * src/trpc/routers/customer.router.ts — realsass-ecommerce-back
 *
 * Procedures para clientes del storefront.
 *
 * Dos tipos de procedure:
 *   publicProcedure    → sin auth (identify, resolveStore, catálogo público)
 *   customerProcedure  → requiere x-customer-id + x-organization-id
 *
 * Procedures públicos (sin auth):
 *   customer.identify        → email → customerId (bootstrap del cliente)
 *   customer.resolveStore    → slug → StoreInfo (bootstrap de la tienda)
 *   customer.getProducts     → catálogo público con filtros opcionales
 *   customer.getProduct      → detalle de producto por handle
 *
 * Procedures autenticados (customerProcedure):
 *   customer.me              → perfil del cliente
 *   customer.orders          → historial de órdenes
 *   customer.orderDetail     → detalle de una orden
 *   customer.cart.get        → carrito por ID
 *   customer.cart.addItem    → agregar variante al carrito
 *   customer.cart.removeItem → quitar variante del carrito
 *   customer.checkout        → convertir carrito en orden
 */
import { z }                                from 'zod';
import { TRPCError }                        from '@trpc/server';
import { router, publicProcedure, customerProcedure } from '../trpc';
import type { CustomersService }            from '../../customers/customers.service';
import type { OrdersService }               from '../../orders/orders.service';
import type { CartService }                 from '../../cart/cart.service';
import type { CatalogService }              from '../../catalog/catalog.service';
import type { StoreService }                from '../../store/store.service';

export function createCustomerRouter(
  customersService: CustomersService,
  ordersService:    OrdersService,
  cartService:      CartService,
  catalogService:   CatalogService,
  storeService:     StoreService,
) {
  return router({

    // ── Bootstrap público (sin auth) ───────────────────────────────────────

    /**
     * customer.identify — @Public
     * Dado un email, devuelve el customerId de la org.
     * Si el cliente no existe, lo crea.
     * Opcionalmente adopta un carrito anónimo al cliente.
     */
    identify: publicProcedure
      .input(z.object({
        organizationId: z.string().uuid(),
        email:          z.string().email(),
        displayName:    z.string().optional(),
        phone:          z.string().optional(),
        cartId:         z.string().optional(),
      }))
      .mutation(({ input }) =>
        customersService.identify(
          input.organizationId,
          input.email,
          input.displayName,
          input.phone,
          input.cartId,
        ),
      ),

    /**
     * customer.resolveStore — @Public
     * Dado un slug de URL, devuelve el StoreInfo (organizationId, nombre, logo, etc.)
     * Este es el bootstrap de la tienda — se llama UNA vez en el layout del storefront.
     */
    resolveStore: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .query(({ input }) => storeService.resolveBySlug(input.slug)),

    /**
     * customer.getProducts — @Public
     * Lista de productos publicados de una org con filtros opcionales.
     * Equivalente a GET /ecommerce/public/:orgId/catalog
     */
    getProducts: publicProcedure
      .input(z.object({
        organizationId: z.string().uuid(),
        category:       z.string().optional(),
      }))
      .query(({ input }) =>
        catalogService.listProductsPublic(input.organizationId, input.category),
      ),

    /**
     * customer.getProduct — @Public
     * Detalle de un producto publicado por handle (slug del producto).
     * Equivalente a GET /ecommerce/public/:orgId/catalog/:handle
     */
    getProduct: publicProcedure
      .input(z.object({
        organizationId: z.string().uuid(),
        handle:         z.string().min(1),
      }))
      .query(async ({ input }) => {
        const product = await catalogService.getProductPublic(
          input.organizationId,
          input.handle,
        );
        if (!product) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Product '${input.handle}' not found` });
        }
        return product;
      }),

    // ── Autenticados (customerProcedure) ──────────────────────────────────

    /**
     * customer.me — perfil del cliente autenticado
     */
    me: customerProcedure
      .query(({ ctx }) =>
        customersService.findById(ctx.organizationId!, ctx.customerId!),
      ),

    /**
     * customer.orders — historial de órdenes del cliente
     */
    orders: customerProcedure
      .query(async ({ ctx }) => {
        const all = await ordersService.listOrders(ctx.organizationId!);
        return all.filter(o => o.customerId === ctx.customerId);
      }),

    /**
     * customer.orderDetail — detalle de una orden
     */
    orderDetail: customerProcedure
      .input(z.object({ orderId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const order = await ordersService.getOrder(ctx.organizationId!, input.orderId);
        if (!order || (order as any).customerId !== ctx.customerId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }
        return order;
      }),

    // ── Carrito ───────────────────────────────────────────────────────────

    cart: router({

      get: customerProcedure
        .input(z.object({ cartId: z.string() }))
        .query(({ ctx, input }) =>
          cartService.getCart(ctx.organizationId!, input.cartId),
        ),

      addItem: customerProcedure
        .input(z.object({
          variantId: z.string().uuid(),
          quantity:  z.number().int().positive(),
          sessionId: z.string(),
          cartId:    z.string().optional(),
        }))
        .mutation(({ ctx, input }) =>
          cartService.addItem(
            ctx.organizationId!,
            input.sessionId,
            input.variantId,
            input.quantity,
            input.cartId,
          ),
        ),

      removeItem: customerProcedure
        .input(z.object({
          cartId:    z.string(),
          variantId: z.string().uuid(),
        }))
        .mutation(({ ctx, input }) =>
          cartService.removeItem(ctx.organizationId!, input.cartId, input.variantId),
        ),
    }),

    /**
     * customer.checkout — convierte el carrito en orden
     * Reserva stock atómicamente — no tocar la lógica interna.
     */
    checkout: customerProcedure
      .input(z.object({
        cartId:          z.string(),
        shippingAddress: z.object({
          street:     z.string(),
          city:       z.string(),
          state:      z.string().optional(),
          postalCode: z.string(),
          country:    z.string(),
        }),
        shippingCents: z.number().int().nonnegative().optional(),
      }))
      .mutation(({ ctx, input }) =>
        ordersService.checkout(ctx.organizationId!, {
          cartId:          input.cartId,
          customerId:      ctx.customerId!,
          shippingAddress: input.shippingAddress,
          shippingCents:   input.shippingCents,
        }),
      ),
  });
}

export type CustomerRouter = ReturnType<typeof createCustomerRouter>;
