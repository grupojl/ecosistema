import Link from 'next/link'
import { Button, EmptyState } from '@real/ui'

export default function ProductNotFound() {
  return (
    <EmptyState
      className="my-24"
      title="Producto no encontrado"
      description="Puede que ya no esté disponible."
      action={<Button asChild variant="outline"><Link href="../">Volver a productos</Link></Button>}
    />
  )
}
