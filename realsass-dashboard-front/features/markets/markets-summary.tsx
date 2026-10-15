'use client'
import { trpc } from '@/lib/trpc/client'

interface MarketsSummaryProps {
  organizationId: string
}

export function MarketsSummary({ organizationId }: MarketsSummaryProps) {
  // La organización viaja en el header x-organization-id; el prop solo evita consultar sin organización activa.
  const { data = [] } = trpc.markets.list.useQuery(undefined, { enabled: organizationId !== '' })

  const activeCount = data.filter(m => m.isActive).length

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{activeCount}</span>
      {activeCount === 1 ? 'mercado activo' : 'mercados activos'}
      <span className="flex gap-1">
        {data.filter(m => m.isActive).map(m => (
          <span key={m.id} className="text-base" title={m.countryCode}>{getFlagEmoji(m.countryCode)}</span>
        ))}
      </span>
    </div>
  )
}

function getFlagEmoji(countryCode: string): string {
  const offset = 127397
  return [...countryCode.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + offset)).join('')
}
