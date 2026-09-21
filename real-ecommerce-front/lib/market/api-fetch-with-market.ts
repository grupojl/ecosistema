'use client'
import { useMarketStore } from '@/store/use-market-store'

/**
 * Wrapper de fetch que inyecta X-Visitor-Country en cada request.
 * Reemplaza `fetch` en llamadas al ecommerce-back desde el cliente.
 *
 * Uso: import { apiFetch } from '@/lib/market/api-fetch-with-market'
 */
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const country = useMarketStore.getState().currentCountry

  const headers = new Headers(init.headers)
  if (country) headers.set('x-visitor-country', country)

  return fetch(url, { ...init, headers })
}
