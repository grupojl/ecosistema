import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MarketState {
  currentCountry:    string | null  // ISO 3166-1 alpha-2 o null (usa default del backend)
  setCountry:        (code: string) => void
  clearCountry:      () => void
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
        ? {
            getItem:    (k)    => sessionStorage.getItem(k),
            setItem:    (k, v) => sessionStorage.setItem(k, v),
            removeItem: (k)    => sessionStorage.removeItem(k),
          }
        : undefined,
    }
  )
)
