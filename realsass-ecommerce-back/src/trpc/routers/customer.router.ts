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
import { router, publicProcedure, customerProcedure } from '@/trpc';
import type { CustomersService }            from '@/customers/customers.service';
import { CUSTOMER_SESSION_COOKIE, type CustomerSessionService } from '@/customers/customer-session.service';
import type { OrdersService }               from '@/orders/orders.service';
import type { CartService }                 from '@/cart/cart.service';
import type { CatalogService }              from '@/catalog/catalog.service';
import type { StoreService }                from '@/store/store.service';
import { rethrowAsTrpcStoreError }          from '@/store/store.trpc-errors';
import { runInTenant }                      from '@/prisma/tenant-context';

/** Decide si una tienda puede recibir clientes nuevos (existe y está abierta). Lo implementa OrganizationsClientService. */
export interface StorefrontGate {
  assertStorefrontOpen(organizationId: string): Promise<void>;
}

export function createCustomerRouter(
  customersService: CustomersService,
  ordersService:    OrdersService,
  cartService:      CartService,
  catalogService:   CatalogService,
  storeService:     StoreService,
  customerSessions: CustomerSessionService,
  storefrontGate:   StorefrontGate,
) {
  return router({

    // ── Bootstrap público (sin auth) ───────────────────────────────────────

    /**
     * customer.identify — @Public
     * Abre la sesión del cliente: el servidor firma un token y lo entrega en una cookie HttpOnly
     * (store_session). El token NO viaja en el body: el JavaScript del front nunca lo ve.
     *
     *  - Sin sesión previa: crea un invitado nuevo. Nunca busca por email ni devuelve una cuenta
     *    existente: saber el email de alguien no da acceso a su cuenta.
     *  - Con una sesión válida de la misma tienda: la continúa y completa los datos de contacto.
     *
     * Rate limit estricto (ver trpc.module): crea filas, así que es el endpoint más abusable.
     */
    identify: publicProcedure
      .input(z.object({
        organizationId: z.string().uuid(),
        email:          z.string().email().max(254).optional(),
        displayName:    z.string().max(120).optional(),
        phone:          z.string().max(40).optional(),
      }))
      .mutation(({ ctx, input }) =>
        // ADR-027: la base solo deja ver/escribir filas de ESTA tienda durante todo el handler.
        runInTenant(input.organizationId, async () => {
          // identify CREA filas: solo para tiendas que existen y están abiertas (no para UUID inventados).
          await storefrontGate.assertStorefrontOpen(input.organizationId);
          const { token, ...session } = await customersService.identify(
            input.organizationId,
            ctx.customerId && ctx.customerOrganizationId
              ? { customerId: ctx.customerId, organizationId: ctx.customerOrganizationId }
              : null,
            { email: input.email, displayName: input.displayName, phone: input.phone },
          );
          ctx.res.cookie(CUSTOMER_SESSION_COOKIE, token, customerSessions.cookieOptions());
          return session; // { customerId, isNew, expiresAt } — sin el token
        }),
      ),

    /** customer.logout — @Public. Borra la cookie de sesión del navegador. */
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(CUSTOMER_SESSION_COOKIE, customerSessions.clearCookieOptions());
      return { ok: true as const };
    }),

    /**
     * customer.resolveStore — @Public
     * Dado un slug de URL, devuelve el StoreInfo (organizationId, nombre, logo, etc.)
     * Este es el bootstrap de la tienda — se llama UNA vez en el layout del storefront.
     */
    resolveStore: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .query(({ input }) => storeService.resolveBySlug(input.slug).catch(rethrowAsTrpcStoreError)),

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
        runInTenant(input.organizationId, () => catalogService.listProductsPublic(input.organizationId, input.category)),
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
      .query(({ input }) =>
        runInTenant(input.organizationId, async () => {
          const product = await catalogService.getProductPublic(
            input.organizationId,
            input.handle,
          );
          if (!product) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Product '${input.handle}' not found` });
          }
          return product;
        }),
      ),

    // ── Autenticados (customerProcedure) ──────────────────────────────────

    /**
     * customer.me — perfil del cliente autenticado
     */
    me: customerProcedure
      .query(({ ctx }) =>
        customersService.findById(ctx.organizationId, ctx.customerId),
      ),

    /**
     * customer.deleteAccount — GDPR/LGPD. Anonimiza la cuenta de la SESIÓN y la cierra.
     * Antes era público y recibía customerId/organizationId por input: con un id cualquiera se anonimizaba
     * la cuenta de otra persona. Ahora el id sale solo de la cookie firmada (customerProcedure).
     */
    deleteAccount: customerProcedure
      .mutation(async ({ ctx }) => {
        const { anonymizedAt } = await customersService.deleteAccount(ctx.organizationId, ctx.customerId);
        ctx.res.clearCookie(CUSTOMER_SESSION_COOKIE, customerSessions.clearCookieOptions());
        return { ok: true as const, anonymizedAt: anonymizedAt.toISOString() };
      }),

    /**
     * customer.orders — historial de órdenes del cliente
     */
    orders: customerProcedure
      .query(async ({ ctx }) => {
        const all = await ordersService.listOrders(ctx.organizationId);
        return all.filter(o => o.customerId === ctx.customerId);
      }),

    /**
     * customer.orderDetail — detalle de una orden
     */
    orderDetail: customerProcedure
      .input(z.object({ orderId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const order = await ordersService.getOrder(ctx.organizationId, input.orderId);
        if (!order || order.customerId !== ctx.customerId) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }
        return order;
      }),

    // ── Carrito ───────────────────────────────────────────────────────────

    cart: router({

      get: customerProcedure
        .input(z.object({ cartId: z.string() }))
        .query(({ ctx, input }) =>
          cartService.getOwnedCart(ctx.organizationId, input.cartId, ctx.customerId),
        ),

      addItem: customerProcedure
        .input(z.object({
          variantId: z.string().uuid(),
          quantity:  z.number().int().positive(),
          /** @deprecated ignorado: el carrito se ata al customerId de la sesión firmada. */
          sessionId: z.string().optional(),
          cartId:    z.string().optional(),
        }))
        .mutation(({ ctx, input }) =>
          cartService.addItem(
            ctx.organizationId,
            ctx.customerId,
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
        .mutation(async ({ ctx, input }) => {
          await cartService.getOwnedCart(ctx.organizationId, input.cartId, ctx.customerId);
          return cartService.removeItem(ctx.organizationId, input.cartId, input.variantId);
        }),
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
        visitorCountryCode:  z.string().length(2).toUpperCase().optional(), // ADR-014
        locale:              z.string().min(2).max(10).optional(), // ADR-016 — idioma de la sesión, para el invoice
      }))
      .mutation(async ({ ctx, input }) => {
        // Solo se puede pagar el carrito propio (mismo NOT_FOUND si no existe o es de otro cliente).
        await cartService.getOwnedCart(ctx.organizationId, input.cartId, ctx.customerId);
        return ordersService.checkout({
          organizationId:  ctx.organizationId,
          cartId:          input.cartId,
          customerId:      ctx.customerId,
          shippingAddress: input.shippingAddress,
          visitorCountryCode: input.visitorCountryCode, // ADR-014
          locale:          input.locale,
        });
      }),
  });
}

export type CustomerRouter = ReturnType<typeof createCustomerRouter>;
