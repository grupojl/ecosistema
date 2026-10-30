import { PageContainer, PageHeader } from '@real/ui'
import { MarketsManager } from '@/features/markets/markets-manager'

export default function MarketsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Mercados activos"
        description="Declaré en qué países operás. El sistema resuelve el fulfillment automáticamente."
      />
      <MarketsManager />
    </PageContainer>
  )
}
