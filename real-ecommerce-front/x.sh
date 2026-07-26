#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# migrate-front-to-ecommerce-back.sh
#
# Corre DENTRO del repo del FRONT real (real-ecomerce-front — el que hoy usa
# lib/catalog/data.ts con datos sintéticos, NO Medusa). Reemplaza ese
# catálogo sintético por un cliente HTTP contra real-ecommerce-back,
# manteniendo los mismos nombres de función que ya usan las páginas
# (getCategories, getCategoryByHandle, getProductsByCategory, getProductById,
# getAllProducts, formatPrice) — el propio código de lib/catalog/index.ts ya
# lo dice en un comentario: "Las firmas son async a propósito: mantienen el
# mismo contrato que tendrá el futuro fetch a un microservicio real".
#
# Requiere que real-ecommerce-back ya tenga corridos:
#   setup-ecommerce-back.sh
#   adapt-backend-to-front.sh   (agrega los 4 endpoints públicos usados acá)
#
# Ejecutar desde la raíz de real-ecomerce-front (donde está app/layout.tsx).
# ═══════════════════════════════════════════════════════════════════════════

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${YELLOW}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

if [ ! -f "app/layout.tsx" ]; then
  fail "No se encontró app/layout.tsx — correr este script desde la raíz de real-ecomerce-front (el FRONT, no el back)"
fi

if [ ! -f "lib/catalog/data.ts" ]; then
  echo -e "${YELLOW}⚠ No se encontró lib/catalog/data.ts — ¿seguro que este es el repo con catálogo sintético?${NC}"
  echo -e "${YELLOW}  (si tu front todavía usa Medusa, es el otro repo/script)${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────
# 1) lib/ecommerce/ — reemplazo de lib/catalog/, mismo shape de función
# ─────────────────────────────────────────────────────────────────────────
log "Creando lib/ecommerce/ (cliente HTTP contra real-ecommerce-back)..."
mkdir -p lib/ecommerce

cat > lib/ecommerce/client.ts << 'EOF'
const ECOMMERCE_API_URL = process.env.NEXT_PUBLIC_ECOMMERCE_API_URL
const ECOMMERCE_ORGANIZATION_ID = process.env.NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID

// Envelope estándar del ecosistema real — { success, data }, ver
// ResponseInterceptor en real-ecommerce-back.
interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/**
 * Fetch base contra los endpoints PÚBLICOS de real-ecommerce-back
 * (/ecommerce/public/:organizationId/...). Sin auth — son rutas @Public().
 *
 * NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID fija qué organización sirve este
 * storefront. Hoy 1 front = 1 organización, igual que el resto del
 * ecosistema (no hay resolución multi-tenant por dominio todavía).
 */
export async function ecommerceFetch<T>(path: string): Promise<T | null> {
  if (!ECOMMERCE_API_URL || !ECOMMERCE_ORGANIZATION_ID) {
    console.error(
      "[ecommerce] Faltan NEXT_PUBLIC_ECOMMERCE_API_URL o NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID en .env.local",
    )
    return null
  }

  try {
    const url = `${ECOMMERCE_API_URL}/ecommerce/public/${ECOMMERCE_ORGANIZATION_ID}${path}`
    const response = await fetch(url, { cache: "no-store" })

    if (!response.ok) {
      console.error("[ecommerce] API error:", response.status, response.statusText, url)
      return null
    }

    const body = (await response.json()) as ApiEnvelope<T>
    return body.data
  } catch (error) {
    console.error("[ecommerce] Error de red contra real-ecommerce-back:", error)
    return null
  }
}

export { ECOMMERCE_API_URL, ECOMMERCE_ORGANIZATION_ID }
EOF

cat > lib/ecommerce/categories.ts << 'EOF'
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
EOF

cat > lib/ecommerce/products.ts << 'EOF'
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
EOF

cat > lib/ecommerce/utils.ts << 'EOF'
// El precio que devuelve real-ecommerce-back ya está en dólares (el
// serializer del backend hace esa conversión una sola vez, del lado del
// servidor) — acá solo se formatea para mostrar.
export function formatPrice(amount: number, currencyCode = "USD"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount)
}
EOF

cat > lib/ecommerce/index.ts << 'EOF'
export * from "./client"
export * from "./categories"
export * from "./products"
export * from "./utils"
EOF
ok "lib/ecommerce/ creado"

# ─────────────────────────────────────────────────────────────────────────
# 2) components/header.tsx — mismo componente, nueva fuente de datos
# ─────────────────────────────────────────────────────────────────────────
log "Actualizando components/header.tsx..."

cat > components/header.tsx << 'EOF'
"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import ShoppingBagModal from "./shopping-bag-modal"
import { getCategories, type Category } from "@/lib/ecommerce"

export default function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  useEffect(() => {
    async function fetchCategories() {
      try {
        const cats = await getCategories()
        setCategories(cats)
      } finally {
        setIsLoadingCategories(false)
      }
    }
    fetchCategories()
  }, [])

  const staticNavItems = [{ label: "Store", href: "/" }]

  const categoryNavItems = categories.map((cat) => ({
    label: cat.name,
    href: `/categoria/${cat.handle}`,
  }))

  const additionalNavItems = [{ label: "Support", href: "#" }]

  const navItems = [...staticNavItems, ...categoryNavItems, ...additionalNavItems]

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-gray-800">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <span className="text-sm font-semibold text-white tracking-tight">Nimbus Store</span>
          </Link>

          <div className="hidden lg:flex items-center space-x-8">
            {isLoadingCategories ? (
              <span className="text-sm text-gray-500">Cargando categorías...</span>
            ) : (
              navItems.map((item) => (
                <Link key={item.label} href={item.href} className="text-sm text-gray-300 hover:text-white transition">
                  {item.label}
                </Link>
              ))
            )}
          </div>

          <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-gray-900 rounded-full transition">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>

            <div className="relative">
              <button
                onClick={() => setIsCartOpen(!isCartOpen)}
                className="p-2 hover:bg-gray-900 rounded-full transition"
              >
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </button>

              {isCartOpen && (
                <div className="absolute right-0 mt-2 w-96">
                  <ShoppingBagModal onClose={() => setIsCartOpen(false)} />
                </div>
              )}
            </div>

            <button className="p-2 hover:bg-gray-900 rounded-full transition lg:hidden">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>
    </header>
  )
}
EOF
ok "header.tsx actualizado"

# ─────────────────────────────────────────────────────────────────────────
# 3) app/categoria/[categoria]/page.tsx
# ─────────────────────────────────────────────────────────────────────────
log "Actualizando app/categoria/[categoria]/page.tsx..."

cat > "app/categoria/[categoria]/page.tsx" << 'EOF'
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
EOF
ok "categoria/[categoria]/page.tsx actualizado"

# ─────────────────────────────────────────────────────────────────────────
# 4) app/products/[handle]/page.tsx
# ─────────────────────────────────────────────────────────────────────────
log "Actualizando app/products/[handle]/page.tsx..."

cat > "app/products/[handle]/page.tsx" << 'EOF'
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
EOF
ok "products/[handle]/page.tsx actualizado"

# ─────────────────────────────────────────────────────────────────────────
# 5) Eliminar el catálogo sintético
# ─────────────────────────────────────────────────────────────────────────
log "Eliminando lib/catalog/ (datos sintéticos)..."
rm -rf lib/catalog
ok "lib/catalog/ eliminado"

# ─────────────────────────────────────────────────────────────────────────
# 6) .env.local.example
# ─────────────────────────────────────────────────────────────────────────
log "Generando .env.local.example..."

cat > .env.local.example << 'EOF'
# URL base de real-ecommerce-back (incluye /api/v1)
NEXT_PUBLIC_ECOMMERCE_API_URL=http://localhost:3005/api/v1

# Organización que sirve este storefront. Hoy 1 front = 1 organización,
# igual que el resto del ecosistema (no hay multi-tenant por dominio todavía).
NEXT_PUBLIC_ECOMMERCE_ORGANIZATION_ID=<uuid-de-la-organizacion>
EOF
ok ".env.local.example generado"

# ─────────────────────────────────────────────────────────────────────────
# 7) Verificación final
# ─────────────────────────────────────────────────────────────────────────
log "Verificando que no queden imports del catálogo sintético..."

if grep -rilE "from [\"']@?/?lib/catalog" app components lib types 2>/dev/null | grep -v ".bak"; then
  echo -e "${YELLOW}ADVERTENCIA: quedaron imports de lib/catalog en los archivos listados arriba. Revisar manualmente.${NC}"
else
  ok "No quedan imports de lib/catalog en app/, components/, lib/, types/"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Front conectado a real-ecommerce-back${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Actualizado: lib/ecommerce/ (nuevo), components/header.tsx,"
echo "             app/categoria/[categoria]/page.tsx, app/products/[handle]/page.tsx"
echo "Eliminado:   lib/catalog/ (datos sintéticos)"
echo ""
echo -e "${YELLOW}Sin tocar (no definen contrato con ningún backend todavía):${NC}"
echo "  - components/shopping-bag-modal.tsx, components/checkout/checkout-flow.tsx"
echo "  - lib/adapters/{correo,envia,welivery}.ts, lib/shipping/*"
echo "  - components/tracking/tracking-view.tsx"
echo ""
echo "Próximos pasos:"
echo "  1. cp .env.local.example .env.local   (completar API_URL y ORGANIZATION_ID)"
echo "  2. Verificar que real-ecommerce-back esté corriendo, con adapt-backend-to-front.sh"
echo "     ya aplicado, y al menos un producto en status: PUBLISHED"
echo "  3. pnpm dev"