import { ecommerceFetch } from "./client"
import type { Product } from "@/types/product"

// El shape que devuelve real-ecommerce-back ya ES types/product.ts — no
// hace falta transformar nada acá, a diferencia de cuando esto vivía en
// lib/catalog/data.ts como arrays sintéticos escritos a mano.

export async function getProductsByCategory(categoryHandle: string): Promise<Product[]> {
  const data = await ecommerceFetch<Product[]>(`/products?category=${encodeURIComponent(categoryHandle)}`)
  return data ?? []
}

export async function getProductById(idOrHandle: string): Promise<Product | null> {
  return ecommerceFetch<Product>(`/products/${idOrHandle}`)
}

export async function getAllProducts(): Promise<Product[]> {
  const data = await ecommerceFetch<Product[]>("/products")
  return data ?? []
}
