/**
 * lib/trpc/types.ts — real-ecommerce-front
 *
 * Tipos inferidos del EcommerceAppRouter — fuente única de tipos del storefront.
 * Reemplaza lib/store/types.ts que duplicaba manualmente los tipos del back.
 *
 * ADR-007: nunca duplicar tipos del back en el front.
 * Si el back cambia un campo, este archivo lo refleja automáticamente.
 */
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter }          from './router-type';

type RouterOutput = inferRouterOutputs<AppRouter>;

/** Tienda resuelta por slug */
export type StoreInfo = NonNullable<RouterOutput['customer']['resolveStore']>;

/** Producto del catálogo público */
export type StoreProduct = RouterOutput['customer']['getProducts'][number];

/** Categoría de producto (inferida de los productos) */
export type StoreCategory = NonNullable<StoreProduct['category']>;

/** Carrito con ítems */
export type CartOutput = NonNullable<RouterOutput['customer']['cart']['get']>;

/** Ítem del carrito */
export type CartItem = CartOutput extends { items: infer I } ? I extends readonly (infer T)[] ? T : never : never;

/** Orden del cliente */
export type OrderOutput = RouterOutput['customer']['orders'][number];

/** Detalle de orden */
export type OrderDetailOutput = RouterOutput['customer']['orderDetail'];

/** Perfil del cliente */
export type CustomerOutput = RouterOutput['customer']['me'];
