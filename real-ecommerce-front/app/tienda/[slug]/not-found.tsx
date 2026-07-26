// app/tienda/[slug]/not-found.tsx
// Se muestra cuando resolveStore() devuelve null o el producto no existe.
import Link from 'next/link'

export default function StoreNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground text-lg">
        Esta tienda no existe o no está disponible.
      </p>
      <p className="text-sm text-muted-foreground max-w-sm">
        Verificá que el link sea correcto. Si sos el dueño de la tienda,
        asegurate de haber activado el módulo de ecommerce desde tu dashboard.
      </p>
      <Link
        href="/"
        className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
