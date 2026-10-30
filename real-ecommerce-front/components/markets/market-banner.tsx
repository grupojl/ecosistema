'use client'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription, Button } from '@real/ui'
import { useMarketStore }      from '@/stores/use-market-store'

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
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 medium:px-6 expanded:px-8">
      <Alert variant="info">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <AlertDescription className="min-w-0 flex-1 text-foreground">
          Parece que estás en <strong>{COUNTRY_NAMES[detectedCountry] ?? detectedCountry}</strong>.
          ¿Querés ver envíos desde nuestro proveedor local?
        </AlertDescription>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => { setCountry(detectedCountry); setDismissed(true) }}>
            Sí, cambiar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
            No, gracias
          </Button>
        </div>
        </div>
      </Alert>
    </div>
  )
}
