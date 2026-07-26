// lib/store/client.ts
//
// Cliente HTTP para los endpoints públicos del ecommerce, usando organizationId
// obtenido dinámicamente (no desde .env).
//
// Todos los fetches son Server Components — sin 'use client'.

import type { StoreProduct, StoreCategory, PaginatedResponse } from './types'

const API_URL = process.env.NEXT_PUBLIC_ECOMMERCE_API_URL

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

async function storeFetch<T>(
  organizationId: string,
  path: string,
  options?: RequestInit & { next?: { revalidate?: number } },
): Promise<T | null> {
  if (!API_URL) return null

  try {
    const url = `${API_URL}/ecommerce/public/${organizationId}${path}`
    const res = await fetch(url, {
      cache: 'no-store',
      ...options,
    })

    if (!res.ok) {
      console.error(`[store] ${res.status} en ${url}`)
      return null
    }

    const body = (await res.json()) as ApiEnvelope<T>
    return body.data
  } catch (err) {
    console.error('[store] Error de red:', err)
    return null
  }
}

// ── Productos ──────────────────────────────────────────────────────────────

export async function getProducts(
  organizationId: string,
  params?: { category?: string; page?: number; limit?: number },
): Promise<PaginatedResponse<StoreProduct> | StoreProduct[]> {
  const qs = new URLSearchParams()
  if (params?.category) qs.set('category', params.category)
  if (params?.page)     qs.set('page', String(params.page))
  if (params?.limit)    qs.set('limit', String(params.limit))

  const query = qs.toString() ? `?${qs}` : ''
  return (await storeFetch<PaginatedResponse<StoreProduct>>(organizationId, `/products${query}`))
    ?? { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
}

export async function getProductByHandle(
  organizationId: string,
  handle: string,
): Promise<StoreProduct | null> {
  return storeFetch<StoreProduct>(organizationId, `/products/${handle}`)
}

// ── Categorías ────────────────────────────────────────────────────────────

export async function getCategories(organizationId: string): Promise<StoreCategory[]> {
  return (await storeFetch<StoreCategory[]>(organizationId, '/categories')) ?? []
}

export async function getCategoryByHandle(
  organizationId: string,
  handle: string,
): Promise<StoreCategory | null> {
  return storeFetch<StoreCategory>(organizationId, `/categories/${handle}`)
}
