import Link from 'next/link'
import { Button, EmptyState } from '@/components/ui'

export default function NotFound() {
  return (
    <EmptyState
      title="Página no encontrada"
      description="Esa sección no existe en el sistema de diseño."
      action={<Button asChild className="mt-1"><Link href="/">Volver al inicio</Link></Button>}
    />
  )
}
