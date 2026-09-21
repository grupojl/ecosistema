'use client'
import { useEffect, useState } from 'react'
import { useMarketStore }      from '@/store/use-market-store'

const COUNTRY_NAMES: Record<string, string> = {
  CO: 'Colombia', MX: 'México', BR: 'Brasil', CL: 'Chile',
  UY: 'Uruguay', PE: 'Perú', EC: 'Ecuador', BO: 'Bolivia', PY: 'Paraguay',
}

interface MarketBannerProps {
  organizationDefaultCountry: string  // AR (o el país base de la org)
  availableCountries:         string[] // Markets activos de la org
}

/**
 * MKT-F-04 — Banner que sugiere cambiar al mercado local del visitante.
 * Patrón Shopify: aparece si el país detectado ≠ país activo de la sesión.
 */
export function MarketBanner({ organizationDefaultCountry, availableCountries }: MarketBannerProps) {
  const { currentCountry, setCountry } = useMarketStore()
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Detectar país via Cloudflare o timezone
    const tz      = Intl.DateTimeFormat().resolvedOptions().timeZone
    const tzMap: Record<string, string> = {
      'America/Bogota': 'CO', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR',
      'America/Santiago': 'CL', 'America/Montevideo': 'UY', 'America/Lima': 'PE',
      'America/Guayaquil': 'EC', 'America/La_Paz': 'BO', 'America/Asuncion': 'PY',
    }
    const detected = tzMap[tz] ?? null
    if (detected && availableCountries.includes(detected)) {
      setDetectedCountry(detected)
    }
  }, [availableCountries])

  // No mostrar si: mismo país, ya elegido, no disponible, o dismissido
  const activeCountry = currentCountry ?? organizationDefaultCountry
  if (dismissed || !detectedCountry || detectedCountry === activeCountry) return null

  return (
    <div
      role="alert"
      className="w-full bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 flex items-center justify-between text-sm"
    >
      <span>
        Parece que estás en <strong>{COUNTRY_NAMES[detectedCountry] ?? detectedCountry}</strong>.
        ¿Querés ver envíos desde nuestro proveedor local?
      </span>
      <div className="flex gap-3 ml-4 shrink-0">
        <button
          onClick={() => { setCountry(detectedCountry); setDismissed(true) }}
          className="font-medium underline underline-offset-2 hover:text-blue-600"
        >
          Sí, cambiar
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-blue-600/60 hover:text-blue-600"
        >
          No, gracias
        </button>
      </div>
    </div>
  )
}
