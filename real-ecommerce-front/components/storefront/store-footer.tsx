import Link from 'next/link'

interface StoreFooterProps {
  storeName:   string
  description: string | null
  poweredBy:   string
  homeHref:    string
  productsHref: string
  categories:  ReadonlyArray<{ id: string; name: string; href: string }>
  labels: {
    shop:       string
    home:       string
    products:   string
    categories: string
  }
}

/** Server Component. Mismo pie en columnas que la base, con los enlaces REALES de la tienda (sin `#`). */
export function StoreFooter({ storeName, description, poweredBy, homeHref, productsHref, categories, labels }: StoreFooterProps) {
  return (
    <footer className="bg-gray-100 text-gray-900 py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2">
            <h3 className="font-semibold text-sm mb-4">{storeName}</h3>
            {description && <p className="text-xs text-gray-600 max-w-sm">{description}</p>}
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-4">{labels.shop}</h3>
            <ul className="space-y-2 text-xs text-gray-600">
              <li><Link href={homeHref} className="hover:text-black">{labels.home}</Link></li>
              <li><Link href={productsHref} className="hover:text-black">{labels.products}</Link></li>
            </ul>
          </div>

          {categories.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-4">{labels.categories}</h3>
              <ul className="space-y-2 text-xs text-gray-600">
                {categories.slice(0, 6).map((c) => (
                  <li key={c.id}><Link href={c.href} className="hover:text-black">{c.name}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-gray-300 pt-8">
          <p className="text-xs text-gray-600 text-center">{poweredBy}</p>
        </div>
      </div>
    </footer>
  )
}
