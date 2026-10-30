import Link from 'next/link'
import { SiteFooter, type FooterColumn } from '@real/ui'

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

/** Server Component. Pie en columnas de @real/ui con los enlaces REALES de la tienda (sin `#`). */
export function StoreFooter({ storeName, description, poweredBy, homeHref, productsHref, categories, labels }: StoreFooterProps) {
  const columns: FooterColumn[] = [
    { title: labels.shop, links: [{ label: labels.home, href: homeHref }, { label: labels.products, href: productsHref }] },
  ]
  if (categories.length > 0) {
    columns.push({ title: labels.categories, links: categories.slice(0, 6).map((c) => ({ label: c.name, href: c.href })) })
  }
  return (
    <SiteFooter className="mt-16" brand={storeName} tagline={description} columns={columns} legal={poweredBy} linkAs={Link} />
  )
}
