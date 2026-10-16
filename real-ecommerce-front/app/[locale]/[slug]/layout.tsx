// app/[locale]/[slug]/layout.tsx

// ISR: revalidar la tienda cada hora. El slug + store info cambia poco.
// Para datos más dinámicos (stock, precios), usar SWR en el Client Component.
// E11-05 — Fase 4 / Escalón 11
export const revalidate = 3600;
// Server Component — resuelve slug + locale antes de renderizar children.
import { notFound } from 'next/navigation'
import { resolveStore, getCategories } from '@/lib/store'
import { StoreProvider } from '@/app/[locale]/[slug]/store-provider'
import { isLocale, getDictionary, t, primaryLocaleForCountry } from '@/lib/i18n'
import { indexableLocalesForStore } from '@/lib/seo/indexing'
import { buildAlternates, robotsFor } from '@/lib/seo/site'
import { JsonLd } from '@/components/seo/json-ld'
import { storeJsonLd } from '@/lib/seo/json-ld'
import { LocaleMemo } from '@/components/storefront/locale-memo'
import { CommerceProvider } from '@/components/commerce/commerce-provider'
import { StoreHeader } from '@/components/commerce/store-header'
import { AuthDialog } from '@/components/commerce/auth-dialog'
import { StoreFooter } from '@/components/storefront/store-footer'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string; slug: string }>
}

async function loadStoreOrNotFound(localeRaw: string, slug: string) {
  if (!isLocale(localeRaw)) notFound()
  const store = await resolveStore(slug)
  if (!store) notFound()
  return { locale: localeRaw, store }
}

/** Las categorías solo decoran el pie: si fallan, la tienda se ve igual (nunca rompe el layout). */
async function loadFooterCategories(organizationId: string, locale: string, slug: string) {
  try {
    const categories = await getCategories(organizationId)
    return categories.map((c) => ({ id: c.id, name: c.name, href: `/${locale}/${slug}/categoria/${c.handle}` }))
  } catch {
    return []
  }
}

export default async function StoreLayout({ children, params }: Props) {
  const { locale: localeRaw, slug } = await params
  const { locale, store } = await loadStoreOrNotFound(localeRaw, slug)
  const dict = getDictionary(locale)
  const storeName = store.name ?? slug
  const homeHref = `/${locale}/${slug}`
  const productsHref = `${homeHref}/productos`
  const categories = await loadFooterCategories(store.organizationId, locale, slug)

  return (
    <StoreProvider store={store}>
     <CommerceProvider organizationId={store.organizationId} storeName={storeName} countryCode={store.countryCode} slug={slug} locale={locale}>
      <div className="min-h-screen bg-background">
        <StoreHeader storeName={storeName} logoUrl={store.logoUrl} />
        <AuthDialog />

        <LocaleMemo locale={locale} />
        {/* Sin contenedor: cada página decide su ancho (la home usa secciones a pantalla completa). */}
        <main>{children}</main>

        <StoreFooter
          storeName={storeName}
          description={store.description}
          poweredBy={t(dict.store.poweredBy, { store: storeName })}
          homeHref={homeHref}
          productsHref={productsHref}
          categories={categories}
          labels={{
            shop:       dict.store.footerShop,
            home:       dict.nav.home,
            products:   dict.nav.products,
            categories: dict.store.categories,
          }}
        />
      </div>
     </CommerceProvider>

      <JsonLd
        data={storeJsonLd({
          name:        storeName,
          url:         `/${locale}/${slug}`,
          description: store.description,
          logoUrl:     store.logoUrl,
          website:     store.website,
        })}
      />
    </StoreProvider>
  )
}

export async function generateMetadata({ params }: Props) {
  const { locale: localeRaw, slug } = await params
  const { locale, store } = await loadStoreOrNotFound(localeRaw, slug)
  const dict = getDictionary(locale)
  const storeName = store.name ?? slug
  const indexable = indexableLocalesForStore(store)

  return {
    title: { default: storeName, template: `%s · ${storeName}` },
    description: store.description ?? t(dict.store.defaultDescription, { store: storeName }),
    alternates: buildAlternates({ path: `/${slug}`, currentLocale: locale, indexableLocales: indexable }),
    robots: robotsFor(locale, indexable),
    twitter: { card: 'summary_large_image', title: storeName, description: store.description ?? t(dict.store.defaultDescription, { store: storeName }) },
    openGraph: {
      title: storeName,
      description: store.description ?? undefined,
      locale: `${locale}_${store.countryCode}`,
      images: store.logoUrl ? [store.logoUrl] : undefined,
    },
  }
}
