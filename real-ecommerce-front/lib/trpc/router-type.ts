/**
 * router-type.ts — real-ecommerce-front
 *
 * Capa 5 completa: AppRouter tipado desde @real/trpc.
 * ecommerce-front conecta con realsass-ecommerce-back.
 *
 * EcommerceAppRouter expone dos contextos:
 *   adminCatalog.* / adminInventory.* / adminOrders.*  → OWNER/COLLABORATOR
 *   customer.*                                          → CustomerContext (sin Firebase)
 *
 * El storefront usa customer.* — sin Bearer token, identificado por
 * x-customer-id header seteado tras POST /customers/identify.
 */
import type { EcommerceAppRouter } from '@real/trpc';

export type AppRouter = EcommerceAppRouter;
