/**
 * use-shopping-bag-store.ts — real-ecommerce-front
 *
 * Estado de UI del modal de shopping bag (carrito).
 * Solo open/close — el contenido del carrito vive en TanStack Query (use-cart.ts).
 *
 * Regla dura: este store no tiene campos de productos, totales ni customerId.
 * Si necesitás esos datos, usá useCart() de @/hooks/use-cart.
 */
import { create } from 'zustand';

interface ShoppingBagState {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
  toggle: () => void;
}

export const useShoppingBagStore = create<ShoppingBagState>((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
