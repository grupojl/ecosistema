import { notFound } from "next/navigation"
import { ProductGallery } from "@/components/product/product-gallery"
import { ProductInfo } from "@/components/product/product-info"
import { WhatsInBox } from "@/components/product/whats-in-box"
import { IncludedServices } from "@/components/product/included-services"
import { RelatedProducts } from "@/components/product/related-products"
import { getProductById, getAllProducts } from "@/lib/ecommerce"

interface ProductPageProps {
  params: Promise<{
    handle: string
  }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params

  const product = await getProductById(handle)

  if (!product) {
    notFound()
  }

  return (
    <main className="min-h-screen">
      <section className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <ProductGallery images={product.images} productName={product.name} />
          <ProductInfo product={product} />
        </div>
      </section>

      {product.whatsInBox.length > 0 && (
        <section className="container mx-auto px-4">
          <WhatsInBox items={product.whatsInBox} />
        </section>
      )}

      {product.includedServices && product.includedServices.length > 0 && (
        <section className="container mx-auto px-4">
          <IncludedServices services={product.includedServices} />
        </section>
      )}

      {product.relatedProducts && product.relatedProducts.length > 0 && (
        <section className="container mx-auto px-4">
          <RelatedProducts products={product.relatedProducts} />
        </section>
      )}
    </main>
  )
}

export async function generateStaticParams() {
  const products = await getAllProducts()
  return products.map((product) => ({
    handle: product.id,
  }))
}
