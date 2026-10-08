// features/store/types.ts
// Tipos del módulo Tienda — inferidos del contrato EcommerceAppRouter (@real/trpc).
// Nada escrito a mano: si el back cambia un shape, el front deja de compilar.
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { EcommerceAppRouter } from '@real/trpc';

type RouterOutputs = inferRouterOutputs<EcommerceAppRouter>;
type RouterInputs  = inferRouterInputs<EcommerceAppRouter>;

export type Product      = RouterOutputs['adminCatalog']['list'][number];
export type ProductVariant = Product['variants'][number];
export type ProductInput = RouterInputs['adminCatalog']['create'];
export type ProductPatch = RouterInputs['adminCatalog']['update']['data'];
export type ProductStatus = Product['status'];

export type Order       = RouterOutputs['adminOrders']['list'][number];
export type OrderItem   = Order['items'][number];
export type OrderStatus = Order['status'];

export interface OrderFilters {
  status?: OrderStatus;
}
