import Link from 'next/link'

export default function ProductNotFound() {
  return (
    <div className="text-center py-24 space-y-4">
      <h1 className="text-2xl font-bold">Producto no encontrado</h1>
      <Link href="../" className="text-primary underline">Volver a productos</Link>
    </div>
  )
}
