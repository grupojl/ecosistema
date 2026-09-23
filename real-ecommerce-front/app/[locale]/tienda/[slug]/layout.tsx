// app/[locale]/tienda/[slug]/layout.tsx
// Server Component — resuelve slug + locale antes de renderizar children.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { resolveStore } from '@/lib/store'
import { StoreProvider } from './store-provider'
import { isLocale, getDictionary, t, primaryLocaleForCountry } from '@/lib/i18n'
import { indexableLocalesForStore } from '@/lib/seo/indexing'
import { buildAlternates, robotsFor } from '@/lib/seo/site'
import { JsonLd } from '@/components/seo/json-ld'
import { storeJsonLd } from '@/lib/seo/json-ld'
import { LocaleSwitcher } from '@/components/storefront/locale-switcher'
import { LocaleMemo } from '@/components/storefront/locale-memo'

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

export default async function StoreLayout({ children, params }: Props) {
  const { locale: localeRaw, slug } = await params
  const { locale, store } = await loadStoreOrNotFound(localeRaw, slug)
  const dict = getDictionary(locale)
  const storeName = store.name ?? slug

  return (
    <StoreProvider store={store}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {store.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt={storeName} className="h-8 w-8 rounded object-cover" />
              )}
              <span className="font-semibold text-lg">{storeName}</span>
            </div>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link href={`/${locale}/tienda/${slug}`} className="hover:text-foreground transition-colors">
                {dict.nav.home}
              </Link>
              <Link href={`/${locale}/tienda/${slug}/productos`} className="hover:text-foreground transition-colors">
                {dict.nav.products}
              </Link>
            </nav>
            <LocaleSwitcher current={locale} label={dict.localeSwitcher.label} />
          </div>
        </header>

        <LocaleMemo locale={locale} />
        <main className="container mx-auto px-4 py-8">{children}</main>

        <footer className="border-t border-border mt-16 py-8 text-center text-sm text-muted-foreground">
          {t(dict.store.poweredBy, { store: storeName })}
        </footer>
      </div>

      <JsonLd
        data={storeJsonLd({
          name:        storeName,
          url:         `/${locale}/tienda/${slug}`,
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
    alternates: buildAlternates({ path: `/tienda/${slug}`, currentLocale: locale, indexableLocales: indexable }),
    robots: robotsFor(locale, indexable),
    openGraph: {
      title: storeName,
      description: store.description ?? undefined,
      locale: `${locale}_${store.countryCode}`,
      images: store.logoUrl ? [store.logoUrl] : undefined,
    },
  }
}
