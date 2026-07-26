"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { ColorOption, Product } from "@/types/product"
import Link from "next/link"

interface ProductInfoProps {
  product: Product
}

export function ProductInfo({ product }: ProductInfoProps) {
  const [selectedColor, setSelectedColor] = useState<ColorOption | undefined>(product.colors?.[0])

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="secondary" className="mb-3">
          {product.category}
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">{product.name}</h1>
        <p className="text-lg text-muted-foreground mb-6">{product.description}</p>

        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold">${product.price}</span>
          {product.originalPrice && (
            <span className="text-xl text-muted-foreground line-through">${product.originalPrice}</span>
          )}
        </div>
      </div>

      <Separator />

      {product.colors && product.colors.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Color</h3>
          <div className="flex gap-3">
            {product.colors.map((color) => (
              <button
                key={color.name}
                onClick={() => setSelectedColor(color)}
                className={cn(
                  "relative w-12 h-12 rounded-full border-2 transition-all",
                  selectedColor?.name === color.name
                    ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "border-border hover:border-primary",
                )}
                style={{ backgroundColor: color.value }}
                aria-label={color.name}
              >
                {selectedColor?.name === color.name && (
                  <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-md" />
                )}
              </button>
            ))}
          </div>
          {selectedColor && <p className="text-sm text-muted-foreground">{selectedColor.name}</p>}
        </div>
      )}

      {product.specifications.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Specifications</h3>
          <div className="space-y-2">
            {product.specifications.map((spec, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{spec.label}</span>
                <span className="font-medium">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {product.features.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Key Features</h3>
          <ul className="space-y-2">
            {product.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button size="lg" className="flex-1">
          Add to Cart
        </Button>
        <Button size="lg" variant="outline" className="flex-1 bg-transparent">
          <Link href="/checkout">
            Buy Now
          </Link>
        </Button>
      </div>
    </div>
  )
}
