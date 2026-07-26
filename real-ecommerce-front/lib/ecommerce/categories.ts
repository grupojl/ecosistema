import { ecommerceFetch } from "./client"

export interface Category {
  id: string
  handle: string
  name: string
  description: string
}

export async function getCategories(): Promise<Category[]> {
  const data = await ecommerceFetch<Category[]>("/categories")
  return data ?? []
}

export async function getCategoryByHandle(handle: string): Promise<Category | null> {
  return ecommerceFetch<Category>(`/categories/${handle.toLowerCase()}`)
}
