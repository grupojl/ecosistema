// features/store/format.ts
// Helpers de presentación del módulo Tienda. Sin dependencias de React.
import type { OrderStatus, ProductStatus } from '@/features/store/types';

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT:     'Borrador',
  PUBLISHED: 'Publicado',
  ARCHIVED:  'Archivado',
};

export const PRODUCT_STATUS_BADGE: Record<ProductStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT:     'secondary',
  PUBLISHED: 'default',
  ARCHIVED:  'outline',
};

export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED',
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING:   'Pendiente',
  CONFIRMED: 'Confirmado',
  PAID:      'Pagado',
  SHIPPED:   'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  REFUNDED:  'Reembolsado',
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, 'default' | 'secondary' | 'destructive'> = {
  PENDING:   'secondary',
  CONFIRMED: 'default',
  PAID:      'default',
  SHIPPED:   'default',
  DELIVERED: 'default',
  CANCELLED: 'destructive',
  REFUNDED:  'destructive',
};

/** Los precios viajan en centavos (entero). */
export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** "12,50" | "12.50" → 1250. NaN si no es un número. */
export function toCents(input: string): number {
  const value = Number(input.trim().replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}

/** Mismo formato que valida el back: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ */
export const HANDLE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
