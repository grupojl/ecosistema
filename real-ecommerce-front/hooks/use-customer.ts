/**
 * hooks/use-customer.ts
 *
 * Perfil y órdenes del cliente logueado.
 * Solo disponibles cuando customerId está presente en CustomerContext.
 */
'use client';

import { trpc }               from '@/lib/trpc/client';
import { useCustomerContext } from '@/context/customer-context';

export function useCustomerProfile() {
  const { customerId } = useCustomerContext();

  return trpc.customer.me.useQuery(
    undefined,
    {
      enabled:   !!customerId,
      staleTime: 60_000,
    },
  );
}

export function useCustomerOrders() {
  const { customerId } = useCustomerContext();

  return trpc.customer.orders.useQuery(
    undefined,
    {
      enabled:   !!customerId,
      staleTime: 30_000,
    },
  );
}

export function useCustomerOrderDetail(orderId: string | null) {
  const { customerId } = useCustomerContext();

  return trpc.customer.orderDetail.useQuery(
    { orderId: orderId! },
    {
      enabled:   !!customerId && !!orderId,
      staleTime: 30_000,
    },
  );
}
