'use client'

import { useEffect } from 'react'
import { useLocaleStore } from '@/stores/use-locale-store'
import type { Locale } from '@/lib/i18n'

/**
 * Componente invisible: guarda en useLocaleStore el idioma de la página de
 * tienda que el visitante está viendo. Montado en el layout de
 * app/[locale]/tienda/[slug]/ — así checkout() (fuera de esas rutas) puede
 * leer "en qué idioma navegaba" sin necesitar la URL.
 */
export function LocaleMemo({ locale }: { locale: Locale }) {
  useEffect(() => {
    useLocaleStore.getState().setLocale(locale)
  }, [locale])

  return null
}
