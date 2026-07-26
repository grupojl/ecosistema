"use client"

import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import type { Product } from "@/lib/catalog-data"
import Link from "next/link"

interface CatalogLineupProps {
  products: Product[]
}

export function CatalogLineup({ products }: CatalogLineupProps) {
  return (
    <section className="bg-white px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex items-center justify-between">
          <h2 className="text-balance text-4xl font-bold tracking-tight">Explore the lineup.</h2>
          <Button variant="ghost" size="sm" className="gap-2">
            Compare all <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${(product as any).handle || product.id}`}
              className={`group overflow-hidden rounded-2xl ${product.color} p-8 transition-transform hover:scale-105 block`}
            >
              {/* Placeholder image */}
              <div className="mb-6 h-48 bg-white/10 rounded-lg flex items-center justify-center">
                <div className={product.lightColor ? "text-white/50" : "text-gray-600/50"}>
                  <div className="text-sm">Product Image</div>
                  <div className="text-xs opacity-50">Photo</div>
                </div>
              </div>

              <div className={product.lightColor ? "text-white" : "text-gray-900"}>
                <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
                <p className="text-sm opacity-75 mb-4">{product.description}</p>
                <div className="mb-6 text-xs opacity-60">{product.specs}</div>
                <Button variant={product.lightColor ? "secondary" : "default"} size="sm" className="w-full gap-2">
                  Learn more <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
