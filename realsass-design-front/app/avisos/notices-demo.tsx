'use client'

import { Alert, AlertDescription, AlertTitle, SectionHeader } from '@/components/ui'

export function NoticesDemo() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Alertas en línea" description="Contexto de una sección o formulario. Para confirmaciones breves usa un toast." />
      <Alert variant="info"><AlertTitle>Novedad</AlertTitle><AlertDescription>Ya puedes personalizar el tema de tu tienda.</AlertDescription></Alert>
      <Alert variant="success"><AlertTitle>Pedido confirmado</AlertTitle><AlertDescription>Enviamos el recibo por correo.</AlertDescription></Alert>
      <Alert variant="warning"><AlertTitle>Stock bajo</AlertTitle><AlertDescription>3 productos están por agotarse.</AlertDescription></Alert>
      <Alert variant="destructive"><AlertTitle>Pago rechazado</AlertTitle><AlertDescription>El banco rechazó la tarjeta. Prueba con otra o contacta a tu banco.</AlertDescription></Alert>
    </section>
  )
}
