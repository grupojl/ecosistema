'use client'

/**
 * Bolsa (carrito) del cliente de ESTA tienda.
 *
 * El carrito vive en el back (customer.cart.*); acá solo se guarda el cartId, por tienda. Requiere cliente ingresado:
 * todos los procedures de carrito son `customerProcedure`.
 */
import { useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'
import { useCommerce } from '@/components/commerce/commerce-provider'
import { summarizeCart, hasMixedCurrencies } from '@/lib/commerce/cart-math'

/** El back responde 500 con el texto original: un carrito borrado o ya convertido en pedido se reconoce por el mensaje. */
const CART_GONE = /no encontrado/i

export function useBag() {
  const { cartId, customer, sessionId, setCartId } = useCommerce()
  const utils = trpc.useUtils()

  const query = trpc.customer.cart.get.useQuery(
    { cartId: cartId ?? '' },
    { enabled: !!cartId && !!customer, retry: false },
  )

  // Carrito inexistente (p. ej. borrado): empezar de cero en vez de quedar con un error permanente.
  useEffect(() => {
    if (query.error && CART_GONE.test(query.error.message)) setCartId(null)
  }, [query.error, setCartId])

  const add = trpc.customer.cart.addItem.useMutation({
    onSuccess: (cart) => {
      setCartId(cart.id)
      utils.customer.cart.get.setData({ cartId: cart.id }, cart)
    },
  })

  const remove = trpc.customer.cart.removeItem.useMutation({
    onSuccess: (cart) => {
      if (cartId) utils.customer.cart.get.setData({ cartId }, cart)
    },
  })

  const lines = cartId && customer ? (query.data?.items ?? []) : []

  return {
    lines,
    summary:       summarizeCart(lines),
    mixedCurrency: hasMixedCurrencies(lines),
    isLoading:     !!cartId && !!customer && query.isLoading,
    addItem:       (variantId: string, quantity: number) =>
      add.mutateAsync({ variantId, quantity, sessionId, ...(cartId ? { cartId } : {}) }),
    removeItem:    (variantId: string) =>
      cartId ? remove.mutateAsync({ cartId, variantId }) : Promise.resolve(null),
    isAdding:      add.isPending,
    removingId:    remove.isPending ? remove.variables?.variantId ?? null : null,
    addError:      add.error?.message ?? null,
  }
}
