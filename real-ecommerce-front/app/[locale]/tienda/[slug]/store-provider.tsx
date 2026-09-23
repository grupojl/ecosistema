// app/[locale]/tienda/[slug]/store-provider.tsx
'use client'

import { createContext, useContext } from 'react'
import type { StoreInfo } from '@/lib/trpc/types'

const StoreContext = createContext<StoreInfo | null>(null)

export function StoreProvider({ children, store }: { children: React.ReactNode; store: StoreInfo }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): StoreInfo {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider')
  return ctx
}
