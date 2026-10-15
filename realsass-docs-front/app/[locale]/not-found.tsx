import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">No encontramos esa página</h1>
      <p className="mt-3 text-muted-foreground">Puede que se haya movido o que todavía no esté publicada.</p>
      <Link href="/es/docs" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        Volver al inicio de la documentación
      </Link>
    </main>
  )
}
