/**
 * hooks/use-cart.ts
 *
 * Carrito persistente via tRPC.
 * El cartId se guarda en localStorage para sobrevivir recargas.
 *
 * Reemplaza el mockCart hardcodeado de components/checkout/checkout-flow.tsx
 */
'use client';

import { useState, useEffect }  from 'react';
import { trpc }                 from '@/lib/trpc/client';
import { useCustomerContext }   from '@/context/customer-context';

function getStoredCartId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ecommerce_cart_id');
}

function storeCartId(id: string): void {
  localStorage.setItem('ecommerce_cart_id', id);
}

export function useCart() {
  const { customerId } = useCustomerContext();
  const [cartId, setCartId] = useState<string | null>(getStoredCartId);

  const cartQuery = trpc.customer.cartGet.useQuery(
    { cartId: cartId! },
    { enabled: !!cartId && !!customerId },
  );

  return { cartId, cartQuery };
}

export function useAddToCart() {
  const { sessionId } = useCustomerContext();
  const utils         = trpc.useUtils();

  return trpc.customer.cartAddItem.useMutation({
    onSuccess: (data: any) => {
      const id = data?.id ?? data?.data?.id;
      if (id) storeCartId(id);
      void utils.customer.cartGet.invalidate();
    },
  });
}

export function useRemoveFromCart() {
  const utils = trpc.useUtils();
  return trpc.customer.cartRemoveItem.useMutation({
    onSuccess: () => void utils.customer.cartGet.invalidate(),
  });
}

export function useCheckout() {
  const utils = trpc.useUtils();
  return trpc.customer.checkout.useMutation({
    onSuccess: () => {
      // Limpiar cartId tras checkout exitoso
      localStorage.removeItem('ecommerce_cart_id');
      void utils.customer.cartGet.invalidate();
      void utils.customer.orders.invalidate();
    },
  });
}
