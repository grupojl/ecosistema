// app/tienda/[slug]/layout.tsx
//
// Server Component — resuelve el slug antes de renderizar cualquier página.
// Si la org no existe o no tiene ecommerce activo → 404 inmediato.
//
// El storeInfo se pasa via searchParams a los children no es posible
// directamente en Next.js App Router — en su lugar lo pasamos via
// un Context client-side inicializado aquí.

import { notFound } from 'next/navigation'
import { resolveStore } from '@/lib/store/resolver'
import { StoreProvider } from './store-provider'

interface Props {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function StoreLayout({ children, params }: Props) {
  const { slug } = await params
  const store = await resolveStore(slug)

  if (!store) notFound()

  return (
    <StoreProvider store={store}>
      <div className="min-h-screen bg-background">
        {/* Header simple de la tienda */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {store.logoUrl && (
                <img
                  src={store.logoUrl}
                  alt={store.name ?? slug}
                  className="h-8 w-8 rounded object-cover"
                />
              )}
              <span className="font-semibold text-lg">
                {store.name ?? slug}
              </span>
            </div>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <a href={`/tienda/${slug}`} className="hover:text-foreground transition-colors">
                Inicio
              </a>
              <a href={`/tienda/${slug}/productos`} className="hover:text-foreground transition-colors">
                Productos
              </a>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-border mt-16 py-8 text-center text-sm text-muted-foreground">
          {store.name ?? slug} — impulsado por Welver
        </footer>
      </div>
    </StoreProvider>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const store = await resolveStore(slug)

  return {
    title: store?.name ?? slug,
    description: store?.description ?? `Tienda de ${slug}`,
  }
}
