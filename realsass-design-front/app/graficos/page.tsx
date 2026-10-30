import type { Metadata } from 'next'
import { ChartsDemo } from './charts-demo'

export const metadata: Metadata = { title: 'Gráficos' }

export default function GraficosPage() {
  return <ChartsDemo />
}
