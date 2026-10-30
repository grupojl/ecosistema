'use client'

import { Badge, Card, CardContent, useSizeClass, type SizeClass } from '@/components/ui'

const NAV: Record<SizeClass, string> = {
  compact: 'Barra inferior',
  medium: 'Riel lateral',
  expanded: 'Barra lateral colapsable',
}

export function SizeClassLive() {
  const size = useSizeClass()
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-6">
        <Badge>{size}</Badge>
        <span className="text-sm">Navegación del panel: <span className="font-medium">{NAV[size]}</span></span>
      </CardContent>
    </Card>
  )
}
