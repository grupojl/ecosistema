import type { OrderStatus } from '@/domain/order.errors';

export const ORDERS_REPOSITORY = Symbol('ORDERS_REPOSITORY');

export interface OrderItemRecord {
  id:                    string;
  orderId:               string;
  variantId:             string;
  quantity:              number;
  unitPriceCentsSnapshot: number;
  variant: {
    id:      string;
    sku:     string;
    title:   string;
    product: { id: string; name: string };
  };
}

export interface OrderRecord {
  id:              string;
  organizationId:  string;
  cartId:          string;
  customerId:      string;
  status:          OrderStatus;
  subtotalCents:   number;
  shippingCents:   number;
  totalCents:      number;
  currency:        string;
  shippingAddress: Record<string, unknown> | null;
  paymentIntentId: string | null;
  createdAt:       Date;
  updatedAt:       Date;
  items:           OrderItemRecord[];
}

export interface CreateOrderInput {
  organizationId:  string;
  cartId:          string;
  customerId:      string;
  items: Array<{
    variantId:              string;
    quantity:               number;
    unitPriceCentsSnapshot: number;
  }>;
  subtotalCents:    number;
  shippingCents:    number;
  totalCents:       number;
  currency:         string;
  shippingAddress?: Record<string, unknown>;
}

export interface IOrdersRepository {
  findById(organizationId: string, orderId: string): Promise<OrderRecord | null>;
  findByCart(organizationId: string, cartId: string): Promise<OrderRecord[]>;
  listByOrg(
    organizationId: string,
    filters?: { status?: OrderStatus; page?: number; limit?: number },
  ): Promise<{ items: OrderRecord[]; total: number }>;
  create(input: CreateOrderInput): Promise<OrderRecord>;
  updateStatus(orderId: string, status: OrderStatus): Promise<OrderRecord>;
  setPaymentIntent(orderId: string, paymentIntentId: string): Promise<void>;
}
