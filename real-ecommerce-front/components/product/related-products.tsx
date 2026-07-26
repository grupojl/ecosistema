import Image from "next/image"
import Link from "next/link"
import type { RelatedProduct } from "@/types/product"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface RelatedProductsProps {
  products: RelatedProduct[]
  title?: string
}

export function RelatedProducts({ products, title = "Which product is right for you?" }: RelatedProductsProps) {
  return (
    <section className="py-12 md:py-16">
      <h2 className="text-3xl md:text-4xl font-semibold text-center mb-8 text-balance">{title}</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="group hover:shadow-lg transition-shadow">
            <CardContent className="p-6 space-y-4">
              <div className="aspect-[3/4] relative overflow-hidden rounded-lg bg-muted">
                <Image
                  src={product.image || "/placeholder.svg"}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="space-y-2 text-center">
                <h3 className="font-semibold text-lg">{product.name}</h3>
                {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
                <p className="font-bold text-xl">${product.price}</p>

                <Button asChild variant="outline" className="w-full mt-2 bg-transparent">
                  <Link href={`/product/${product.id}`}>View Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
