/**
 * stores/use-market-store.ts — real-ecommerce-front
 * HARD-09 fix: createJSONStorage para tipo PersistStorage<T> correcto.
 * Movido de store/ (singular) a stores/ (plural) — convención del proyecto.
 */
import { create }                        from 'zustand'
import { persist, createJSONStorage }    from 'zustand/middleware'

interface MarketState {
  currentCountry: string | null
  setCountry:     (code: string) => void
  clearCountry:   () => void
}

export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      currentCountry: null,
      setCountry:     (code) => set({ currentCountry: code.toUpperCase() }),
      clearCountry:   () => set({ currentCountry: null }),
    }),
    {
      name:    'visitor-market',
      storage: typeof window !== 'undefined'
        ? createJSONStorage(() => sessionStorage)
        : undefined,
    },
  ),
)
