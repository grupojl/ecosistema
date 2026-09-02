/**
 * order.types.ts — realsass-ecommerce-back
 *
 * Tipos de retorno de OrdersService — sin `as any`.
 * Se usan en los routers tRPC para tipado correcto de los retornos.
 *
 * Nota: estos son tipos de "output" del servicio, no entidades de dominio puras.
 * El Domain/Repository completo de orders va en S4.
 */

export interface OrderItemOutput {
  id:                      string;
  variantId:               string;
  quantity:                number;
  unitPriceCentsSnapshot:  number;
}

export interface OrderStatusEventOutput {
  id:         string;
  fromStatus: string | null;
  toStatus:   string;
  reason:     string | null;
  createdAt:  Date;
}

export interface OrderOutput {
  id:              string;
  organizationId:  string;
  customerId:      string;
  cartId:          string;
  status:          string;
  totalCents:      number;
  shippingCents:   number;
  paymentIntentId: string | null;
  // @real/jsonb-cast
  shippingAddress: Record<string, unknown>;
  createdAt:       Date;
  updatedAt:       Date;
  items?:          OrderItemOutput[];
  statusHistory?:  OrderStatusEventOutput[];
}
