import { CatalogHeader } from "@/components/catalog/catalog-header"
import { CatalogLineup } from "@/components/catalog/catalog-lineup"
import { CatalogCloserLook } from "@/components/catalog/catalog-closer-look"
import { CatalogFeatures } from "@/components/catalog/catalog-features"
import { CatalogFooter } from "@/components/catalog/catalog-footer"
import { notFound } from "next/navigation"
import { getCategories, getCategoryByHandle, getProductsByCategory, formatPrice } from "@/lib/ecommerce"

interface PageProps {
  params: Promise<{
    categoria: string
  }>
}

export default async function CatalogPage({ params }: PageProps) {
  const { categoria } = await params

  const category = await getCategoryByHandle(categoria)

  if (!category) {
    notFound()
  }

  const categoryProducts = await getProductsByCategory(category.handle)

  const gradients = [
    "bg-gradient-to-br from-orange-400 to-orange-600",
    "bg-gradient-to-br from-blue-100 to-blue-200",
    "bg-gradient-to-br from-purple-200 to-pink-200",
    "bg-gradient-to-br from-blue-500 to-indigo-700",
    "bg-gradient-to-br from-slate-400 to-slate-600",
    "bg-gradient-to-br from-cyan-100 to-cyan-200",
  ]

  const products = categoryProducts.map((product, index) => ({
    id: index + 1,
    name: product.name,
    description: product.description,
    price: `Desde ${formatPrice(product.price)}`,
    specs: product.specifications[0]?.value ?? "Ver especificaciones",
    color: gradients[index % gradients.length],
    lightColor: index % 2 === 0,
    handle: product.id,
  }))

  const models = categoryProducts.map((product) => ({
    name: product.name,
    shortName: product.name.split(" ").slice(-1)[0],
  }))

  const allCategories = await getCategories()

  const features = [
    { id: 1, title: "Especificaciones y duración", description: "Descubre los detalles técnicos", icon: "📋" },
    { id: 2, title: "Diseño premium", description: "Calidad y elegancia en cada detalle", icon: "✨" },
    { id: 3, title: "Rendimiento excepcional", description: "Potencia para todo lo que necesitas", icon: "⚡" },
    { id: 4, title: "Tecnología avanzada", description: "Lo último en innovación", icon: "🚀" },
  ]

  void allCategories

  return (
    <main className="min-h-screen bg-white">
      <CatalogHeader title={category.name} models={models} />
      <CatalogLineup products={products} />
      <CatalogCloserLook
        title={`Conoce ${category.name}`}
        description={category.description || `Descubre toda la línea de ${category.name}`}
      />
      <CatalogFeatures features={features} />
      <CatalogFooter />
    </main>
  )
}

export async function generateStaticParams() {
  const categories = await getCategories()
  return categories.map((category) => ({
    categoria: category.handle,
  }))
}
