'use client'
import { useEffect } from 'react'
import { MarketBanner } from './market-banner'

interface MarketProviderProps {
  children:                   React.ReactNode
  organizationDefaultCountry: string
  availableCountries:         string[]
}

/**
 * MKT-F-05 — Provider que envuelve la tienda y muestra el MarketBanner.
 * Agregar en el layout raíz de cada tienda: store/[slug]/layout.tsx
 */
export function MarketProvider({
  children,
  organizationDefaultCountry,
  availableCountries,
}: MarketProviderProps) {
  return (
    <>
      <MarketBanner
        organizationDefaultCountry={organizationDefaultCountry}
        availableCountries={availableCountries}
      />
      {children}
    </>
  )
}
